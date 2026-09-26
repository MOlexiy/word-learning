import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_COOKIE } from '@wl/shared';
import { IS_PUBLIC_KEY } from '../../../common/auth/decorators';
import { TokenService } from '../application/token.service';
import { ApiException } from '../../../common/errors/api.exception';

/** Глобальний guard: усе закрито, крім ендпоінтів з @Public(). Токен — з HttpOnly-куки `auth`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[AUTH_COOKIE];
    if (!token) throw new ApiException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
    req.user = await this.tokens.verifyAccess(token);
    return true;
  }
}
