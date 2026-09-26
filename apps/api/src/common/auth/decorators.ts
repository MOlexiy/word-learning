import { createParamDecorator, type ExecutionContext, HttpStatus, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '@wl/shared';
import type { AuthUser } from './auth-user';
import { ApiException } from '../errors/api.exception';

export const IS_PUBLIC_KEY = 'wl:isPublic';
export const ROLES_KEY = 'wl:roles';

/** Ендпоінт доступний без access-токена. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Обмежує доступ ролями. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw new ApiException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
  return user;
});
