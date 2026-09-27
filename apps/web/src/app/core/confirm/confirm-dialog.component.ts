import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmService } from './confirm.service';

const QUOTE_MAX = 180;

/**
 * Нативний <dialog> у модальному режимі: фон затемнений, фокус усередині вікна, Esc закриває.
 * Фокус за замовчуванням — на «Скасувати», щоб випадковий Enter нічого не видалив.
 */
@Component({
  selector: 'wl-confirm-dialog',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Клік по затемненому фону; з клавіатури те саме робить Esc (подія cancel на <dialog>).
  host: { '(click)': 'onBackdropClick($event)' },
  template: `
    <dialog
      #dialog
      class="confirm-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      (cancel)="$event.preventDefault(); confirm.settle(false)"
    >
      @if (confirm.pending(); as p) {
        <div class="confirm-dialog__body">
          <h2 id="confirm-title" class="confirm-dialog__title">{{ p.titleKey | transloco: p.params }}</h2>
          <div id="confirm-message" class="confirm-dialog__content">
            @if (p.quote) {
              <blockquote class="confirm-dialog__quote" lang="en">{{ shorten(p.quote) }}</blockquote>
            }
            @if (p.messageKey) {
              <p class="confirm-dialog__message">{{ p.messageKey | transloco: p.params }}</p>
            }
          </div>
          <div class="confirm-dialog__actions">
            <button #cancelBtn type="button" class="btn btn--ghost" (click)="confirm.settle(false)">
              {{ 'confirm.cancel' | transloco }}
            </button>
            <button
              type="button"
              class="btn"
              [class.btn--danger-solid]="p.danger"
              [class.btn--primary]="!p.danger"
              (click)="confirm.settle(true)"
            >
              {{ p.confirmKey ?? 'confirm.delete' | transloco }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      const open = this.confirm.pending() !== null;
      if (open && !dialog.open) {
        dialog.showModal();
        queueMicrotask(() => this.cancelBtn()?.nativeElement.focus());
      } else if (!open && dialog.open) {
        dialog.close();
      }
    });
  }

  protected shorten(text: string): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > QUOTE_MAX ? `${clean.slice(0, QUOTE_MAX).trimEnd()}…` : clean;
  }

  /** Клік по затемненому фону (поза вмістом вікна) = «Скасувати». */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.confirm.settle(false);
  }
}
