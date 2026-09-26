import { HttpErrorResponse, type HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SKIP_AUTH_REFRESH, TokenRefreshService } from './token-refresh.service';

/** Ендпоінти, де 401 означає «невірні дані», а не «прострочений access». */
const NO_REFRESH_URLS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

/**
 * 401 → POST /api/auth/refresh (один на всі паралельні запити) → повтор початкового запиту.
 * Якщо refresh не вдався — AuthService переводить застосунок у гостьовий режим / на логін.
 * Куки HttpOnly, тож нічого в заголовки не підставляємо: браузер надішле оновлену `auth` сам.
 */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH_REFRESH) || NO_REFRESH_URLS.some((url) => req.url.startsWith(url))) {
    return next(req);
  }

  const refresher = inject(TokenRefreshService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== HttpStatusCode.Unauthorized) {
        return throwError(() => error);
      }
      return refresher.refresh().pipe(
        catchError(() => {
          auth.handleSessionExpired();
          return throwError(() => error);
        }),
        // Помилки повторного запиту йдуть далі як є — без нового refresh (жодних циклів).
        switchMap((profile) => {
          auth.setProfile(profile);
          return next(req);
        }),
      );
    }),
  );
};
