import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Сторінки учня для вчителя. Сюди ведуть і посилання «Поділитися з вчителем», тому:
 *  - гість → логін з поверненням на це посилання;
 *  - сам учень, що відкрив власне посилання → його ж картка / чернетка;
 *  - інші → кабінет.
 */
export const teacherGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.role() === 'teacher') return true;
  if (!auth.isAuthenticated())
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  const me = auth.user()?.username.toLowerCase();
  if (me && route.paramMap.get('studentUserName')?.toLowerCase() === me) {
    const cardId = route.paramMap.get('id');
    if (cardId) return router.createUrlTree(['/cards', cardId]);
    const { view, draft } = route.queryParams as { view?: string; draft?: string };
    return router.createUrlTree(['/'], { queryParams: { view, draft } });
  }
  return router.createUrlTree(['/profile']);
};

/** Сторінки логіну/реєстрації не потрібні вже залогіненому користувачу. */
export const anonymousOnlyGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/profile']) : true;
