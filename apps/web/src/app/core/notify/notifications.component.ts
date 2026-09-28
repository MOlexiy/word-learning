import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotifyService } from './notify.service';

@Component({
  selector: 'wl-notifications',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (item of notify.items(); track item.id) {
        <div class="toast" [class]="'toast toast--' + item.kind" role="status">
          <span class="toast__message">{{ item.message }}</span>
          @if (item.action; as action) {
            <button type="button" class="toast__action" (click)="notify.runAction(item)">
              {{ action.label }}
            </button>
          }
          <button
            type="button"
            class="toast__close"
            [attr.aria-label]="'common.close' | transloco"
            (click)="notify.dismiss(item.id)"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
})
export class NotificationsComponent {
  protected readonly notify = inject(NotifyService);
}
