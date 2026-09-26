import { HttpStatus, Injectable } from '@nestjs/common';
import type { LoginRequest, RegisterRequest, UserProfile } from '@wl/shared';
import { toUserProfile, type UserRecord } from '../../users/domain/user';
import { UsersRepository } from '../../users/domain/users.repository';
import { PasswordHasher } from '../infrastructure/password-hasher';
import { type IssuedTokens, TokenService } from './token.service';
import { ApiException } from '../../../common/errors/api.exception';

export interface AuthResult {
  profile: UserProfile;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterRequest): Promise<AuthResult> {
    if (await this.users.findByUsername(dto.username)) {
      throw new ApiException(HttpStatus.CONFLICT, 'USERNAME_TAKEN', 'Username is already taken');
    }
    if (await this.users.findByEmail(dto.email)) {
      throw new ApiException(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Email is already registered');
    }
    const user = await this.users.create({
      username: dto.username,
      email: dto.email,
      role: dto.role,
      passwordHash: await this.hasher.hash(dto.password),
    });
    return this.#authenticate(user);
  }

  async login(dto: LoginRequest): Promise<AuthResult> {
    const user = dto.login.includes('@')
      ? await this.users.findByEmail(dto.login)
      : await this.users.findByUsername(dto.login);
    const ok = await this.hasher.verify(dto.password, user?.passwordHash ?? null);
    if (!user || !ok)
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid login or password');
    return this.#authenticate(user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken)
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'REFRESH_TOKEN_MISSING', 'Refresh token is missing');
    const { username, nextJti } = await this.tokens.consumeRefresh(refreshToken);
    const user = await this.users.findByUsername(username);
    if (!user) throw new ApiException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', 'User no longer exists');
    return this.#authenticate(user, nextJti);
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return this.tokens.revokeQuietly(refreshToken);
  }

  async me(username: string): Promise<UserProfile> {
    const user = await this.users.findByUsername(username);
    if (!user) throw new ApiException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', 'User no longer exists');
    return toUserProfile(user);
  }

  async #authenticate(user: UserRecord, jti?: string): Promise<AuthResult> {
    const tokens = await this.tokens.issue({ username: user.username, role: user.role }, jti);
    return { profile: toUserProfile(user), tokens };
  }
}
