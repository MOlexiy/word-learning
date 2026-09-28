import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './core/confirm/confirm-dialog.component';
import { NotificationsComponent } from './core/notify/notifications.component';
import { ServerWakeBannerComponent } from './core/server/server-wake-banner.component';
import { QuickAddSheetComponent } from './features/quick-add/quick-add-sheet.component';
import { HeaderComponent } from './layout/header.component';

@Component({
  selector: 'wl-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    NotificationsComponent,
    ConfirmDialogComponent,
    ServerWakeBannerComponent,
    QuickAddSheetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <wl-header />
    <wl-server-wake-banner />
    <main class="container main">
      <router-outlet />
    </main>
    <wl-notifications />
    <wl-quick-add-sheet />
    <wl-confirm-dialog />
  `,
})
export class App {}
