import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { finalize, type Observable, shareReplay } from 'rxjs';
import type { UserProfile } from '@wl/shared';

/** Позначка для запитів, які інтерцептор не повинен намагатися «рятувати» refresh-ем. */
export const SKIP_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);

/**
 * Гарантує один refresh-запит на всі паралельні 401: перший запит ініціює `/api/auth/refresh`,
 * решта підписуються на той самий Observable і чекають його результату.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  readonly #http = inject(HttpClient);
  #inFlight: Observable<UserProfile> | null = null;

  refresh(): Observable<UserProfile> {
    this.#inFlight ??= this.#http
      .post<UserProfile>('/api/auth/refresh', null, {
        context: new HttpContext().set(SKIP_AUTH_REFRESH, true),
      })
      .pipe(
        finalize(() => (this.#inFlight = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.#inFlight;
  }
}
