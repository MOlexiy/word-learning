import type { Role } from '@wl/shared';

/** Користувач, витягнутий з access-токена. */
export interface AuthUser {
  username: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
