import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { TeacherStatus } from '@wl/shared';

@Component({
  selector: 'wl-status-badge',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'badge badge--' + status()">{{ 'status.' + status() | transloco }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<TeacherStatus>();
}
