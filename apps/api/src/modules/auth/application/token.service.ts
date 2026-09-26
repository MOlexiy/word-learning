import { HttpStatus, Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  type Role,
  type ApiErrorCode,
} from '@wl/shared';
import { ENV, type Env } from '../../../config/env';
import type { AuthUser } from '../../../common/auth/auth-user';
import { Clock } from '../../../common/time/clock';
import { RefreshTokenRepository } from '../domain/refresh-token.repository';
import { ApiException } from '../../../common/errors/api.exception';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

interface AccessPayload {
  sub: string;
  role: Role;
  typ: 'access';
}

interface RefreshPayload {
  sub: string;
  jti: string;
  typ: 'refresh';
}

/**
 * Access — JWT на 1 день (stateless). Refresh — JWT на 30 днів з `jti`, записаним у БД:
 * кожен refresh ротує токен (старий відкликається), а повторне використання вже відкликаного
 * токена сприймається як крадіжка — відкликаються всі сесії користувача.
 */
@Injectable()
export class TokenService implements OnApplicationBootstrap {
  /** Паралельні refresh-запити з кількох вкладок у межах цього вікна не вважаються атакою. */
  private static readonly REUSE_GRACE_MS = 10_000;
  readonly #logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Прибираємо прострочені refresh-токени при старті (для прод-навантаження — винести в cron). */
  async onApplicationBootstrap(): Promise<void> {
    await this.refreshTokens.deleteExpired(this.clock.now());
  }

  async issue(user: AuthUser, jti: string = randomUUID()): Promise<IssuedTokens> {
    const expiresAt = new Date(this.clock.now().getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    await this.refreshTokens.create({ id: jti, userId: user.username, expiresAt });

    const access: AccessPayload = { sub: user.username, role: user.role, typ: 'access' };
    const refresh: Omit<RefreshPayload, 'jti'> = { sub: user.username, typ: 'refresh' };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(access, { secret: this.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL_SECONDS }),
      this.jwt.signAsync(refresh, {
        secret: this.env.JWT_REFRESH_SECRET,
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
        jwtid: jti,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async verifyAccess(token: string): Promise<AuthUser> {
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
      if (payload.typ !== 'access') throw new Error('wrong token type');
      return { username: payload.sub, role: payload.role };
    } catch {
      throw unauthorized('ACCESS_TOKEN_INVALID', 'Access token is invalid or expired');
    }
  }

  /**
   * Перевіряє refresh-токен і відкликає його, резервуючи `jti` для наступного токена.
   * Повертає власника та `nextJti`, який треба передати в `issue()`.
   */
  async consumeRefresh(token: string): Promise<{ username: string; nextJti: string }> {
    const payload = await this.#verifyRefresh(token);
    const stored = await this.refreshTokens.findById(payload.jti);
    const now = this.clock.now();

    if (!stored || stored.userId !== payload.sub || stored.expiresAt <= now) {
      throw unauthorized('REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
    }

    const nextJti = randomUUID();
    if (!stored.revokedAt && (await this.refreshTokens.revoke(stored.id, now, nextJti))) {
      return { username: stored.userId, nextJti };
    }

    // Токен уже відкликано. Прощаємо лише паралельну ротацію (дві вкладки одночасно),
    // але не logout і не повторне використання через довгий час.
    const current = (await this.refreshTokens.findById(stored.id)) ?? stored;
    const rotatedRecently =
      current.replacedById !== null &&
      current.revokedAt !== null &&
      now.getTime() - current.revokedAt.getTime() <= TokenService.REUSE_GRACE_MS;
    if (rotatedRecently) return { username: stored.userId, nextJti };

    if (current.replacedById !== null) {
      this.#logger.warn(`Refresh token reuse detected for user "${stored.userId}" — revoking all sessions`);
      await this.refreshTokens.revokeAllForUser(stored.userId, now);
    }
    throw unauthorized('REFRESH_TOKEN_REUSED', 'Refresh token has already been used');
  }

  /** Для logout: відкликаємо навіть прострочений (але справжній) токен, помилки ігноруємо. */
  async revokeQuietly(token: string | undefined): Promise<void> {
    if (!token) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.env.JWT_REFRESH_SECRET,
        ignoreExpiration: true,
      });
      await this.refreshTokens.revoke(payload.jti, this.clock.now());
    } catch {
      // невалідний токен — нічого відкликати
    }
  }

  async #verifyRefresh(token: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.env.JWT_REFRESH_SECRET,
      });
      if (payload.typ !== 'refresh' || !payload.jti) throw new Error('wrong token type');
      return payload;
    } catch {
      throw unauthorized('REFRESH_TOKEN_INVALID', 'Refresh token is invalid or expired');
    }
  }
}

function unauthorized(code: ApiErrorCode, message: string): ApiException {
  return new ApiException(HttpStatus.UNAUTHORIZED, code, message);
}
