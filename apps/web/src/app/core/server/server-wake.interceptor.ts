import {
  HttpContextToken,
  HttpErrorResponse,
  type HttpEvent,
  type HttpInterceptorFn,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize, identity, type MonoTypeOperatorFunction, retry, throwError, timer } from 'rxjs';
import { ServerStatusService, SLOW_REQUEST_MS } from './server-status.service';

/** Фонові запити (прогрів сервера), які не повинні показувати банер «сервер прокидається». */
export const QUIET_REQUEST = new HttpContextToken<boolean>(() => false);

/** Повтори лише для ідемпотентних методів: POST міг уже виконатися на сервері. */
const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);
/** Разом ≈ 75 с — з запасом покриває холодний старт Render (~1 хв). */
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 15_000, 15_000, 15_000];

/** Сервер ще не відповідає: мережа / проксі Vercel без живого бекенда. */
export function isServerDown(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 0 ||
      error.status === HttpStatusCode.BadGateway ||
      error.status === HttpStatusCode.ServiceUnavailable ||
      error.status === HttpStatusCode.GatewayTimeout)
  );
}

/**
 * Для запитів до `/api`:
 *  - якщо відповідь не прийшла за SLOW_REQUEST_MS — вмикає банер «сервер прокидається»;
 *  - GET/HEAD повторює з наростаючою паузою, поки сервер відповідає 0/502/503/504.
 * Стоїть перед authRefreshInterceptor, тож повтор проходить увесь ланцюжок (включно з refresh на 401).
 */
export const serverWakeInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);

  const status = inject(ServerStatusService);
  const quiet = req.context.get(QUIET_REQUEST);
  const withRetry: MonoTypeOperatorFunction<HttpEvent<unknown>> = RETRYABLE_METHODS.has(req.method)
    ? retry({
        count: RETRY_DELAYS_MS.length,
        delay: (error: unknown, attempt: number) =>
          isServerDown(error) ? timer(RETRY_DELAYS_MS[attempt - 1]) : throwError(() => error),
      })
    : identity;

  return defer(() => {
    const startedAt = Date.now();
    let slow = false;
    const slowTimer = quiet
      ? undefined
      : setTimeout(() => {
          slow = true;
          status.beginSlow(startedAt);
        }, SLOW_REQUEST_MS);

    return next(req).pipe(
      withRetry,
      finalize(() => {
        clearTimeout(slowTimer);
        if (slow) status.endSlow();
      }),
    );
  });
};
