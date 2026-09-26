import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const teacherGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.role() === 'teacher') return true;
  return inject(Router).createUrlTree([auth.isAuthenticated() ? '/profile' : '/login']);
};

/** Сторінки логіну/реєстрації не потрібні вже залогіненому користувачу. */
export const anonymousOnlyGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/profile']) : true;
