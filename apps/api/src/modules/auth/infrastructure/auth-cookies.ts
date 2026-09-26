import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS, AUTH_COOKIE, REFRESH_COOKIE, REFRESH_TOKEN_TTL_SECONDS } from '@wl/shared';
import { ENV, type Env } from '../../../config/env';
import type { IssuedTokens } from '../application/token.service';

/** Refresh-кука надсилається браузером лише на /api/auth/* — не «світиться» в кожному запиті. */
export const REFRESH_COOKIE_PATH = '/api/auth';

@Injectable()
export class AuthCookies {
  readonly #base: CookieOptions;

  constructor(@Inject(ENV) env: Env) {
    this.#base = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'strict' };
  }

  set(res: Response, tokens: IssuedTokens): void {
    res.cookie(AUTH_COOKIE, tokens.accessToken, {
      ...this.#base,
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.#base,
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }

  clear(res: Response): void {
    res.clearCookie(AUTH_COOKIE, { ...this.#base, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...this.#base, path: REFRESH_COOKIE_PATH });
  }
}
