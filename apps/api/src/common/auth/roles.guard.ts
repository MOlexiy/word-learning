import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@wl/shared';
import { ROLES_KEY } from './decorators';
import { ApiException } from '../errors/api.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN_ROLE', `Allowed roles: ${roles.join(', ')}`);
    }
    return true;
  }
}
