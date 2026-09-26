import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationsComponent } from './core/notify/notifications.component';
import { HeaderComponent } from './layout/header.component';

@Component({
  selector: 'wl-root',
  imports: [RouterOutlet, HeaderComponent, NotificationsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <wl-header />
    <main class="container main">
      <router-outlet />
    </main>
    <wl-notifications />
  `,
})
export class App {}
