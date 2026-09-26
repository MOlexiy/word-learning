import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { GuestImportComponent } from './guest-import.component';
import { StudentPanelComponent } from './student-panel.component';
import { TeacherPanelComponent } from './teacher-panel.component';

@Component({
  selector: 'wl-profile-page',
  imports: [RouterLink, TranslocoPipe, StudentPanelComponent, TeacherPanelComponent, GuestImportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ 'profile.title' | transloco }}</h1>
    @if (auth.user(); as user) {
      <section class="panel">
        <dl class="props">
          <dt>{{ 'profile.username' | transloco }}</dt>
          <dd>{{ user.username }}</dd>
          <dt>{{ 'profile.email' | transloco }}</dt>
          <dd>{{ user.email }}</dd>
          <dt>{{ 'profile.role' | transloco }}</dt>
          <dd>{{ 'roles.' + user.role | transloco }}</dd>
        </dl>
        <button class="btn btn--ghost" type="button" (click)="auth.logout()">
          {{ 'profile.logout' | transloco }}
        </button>
      </section>

      <wl-guest-import />

      @if (user.role === 'student') {
        <wl-student-panel />
      } @else {
        <wl-teacher-panel />
      }
    } @else {
      <section class="panel">
        <p>{{ 'profile.guestText' | transloco }}</p>
        <div class="actions">
          <a class="btn btn--primary" routerLink="/login">{{ 'profile.login' | transloco }}</a>
          <a class="btn" routerLink="/register">{{ 'profile.register' | transloco }}</a>
        </div>
      </section>
    }
  `,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
}
