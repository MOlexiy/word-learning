import type { Routes } from '@angular/router';
import { anonymousOnlyGuard, teacherGuard } from './core/auth/auth.guards';

/** `title` — i18n-ключ, перекладається TranslatedTitleStrategy. */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'titles.cards',
    loadComponent: () => import('./features/cards/pages/card-list.page').then((m) => m.CardListPage),
  },
  {
    path: 'cards/new',
    title: 'titles.newCard',
    loadComponent: () => import('./features/cards/pages/card-create.page').then((m) => m.CardCreatePage),
  },
  {
    path: 'cards/:id',
    title: 'titles.card',
    loadComponent: () => import('./features/cards/pages/card-detail.page').then((m) => m.CardDetailPage),
  },
  {
    path: 'profile',
    title: 'titles.profile',
    loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'students/:studentUserName',
    title: 'titles.studentCards',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/students/student-cards.page').then((m) => m.StudentCardsPage),
  },
  {
    path: 'students/:studentUserName/cards/:id',
    title: 'titles.studentCard',
    canActivate: [teacherGuard],
    loadComponent: () =>
      import('./features/students/student-card-detail.page').then((m) => m.StudentCardDetailPage),
  },
  {
    path: 'login',
    title: 'titles.login',
    canActivate: [anonymousOnlyGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'titles.register',
    canActivate: [anonymousOnlyGuard],
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
  },
  { path: '**', redirectTo: '' },
];
