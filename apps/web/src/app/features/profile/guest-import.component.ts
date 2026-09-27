import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';
import { CardStorageService } from '../cards/data/card-storage.service';

/** Перенесення гостьових карток (LocalStorage) разом з інтервалами в акаунт. */
@Component({
  selector: 'wl-guest-import',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (count() > 0) {
      <section class="panel panel--accent">
        <h2 class="section-title">{{ 'profile.import.title' | transloco }}</h2>
        <p>{{ 'profile.import.found' | transloco: { count: count() } }}</p>
        <label class="checkbox">
          <input
            type="checkbox"
            id="guest-import-clear"
            name="clearAfter"
            [checked]="clearAfter()"
            (change)="clearAfter.set($any($event.target).checked)"
          />
          {{ 'profile.import.clearAfter' | transloco }}
        </label>
        <div class="actions">
          <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="importCards()">
            {{ 'profile.import.submit' | transloco }}
          </button>
          <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="discard()">
            {{ 'profile.import.discard' | transloco }}
          </button>
        </div>
      </section>
    }
  `,
})
export class GuestImportComponent {
  readonly #storage = inject(CardStorageService);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);

  protected readonly count = signal(this.#storage.guestCardCount());
  protected readonly clearAfter = signal(true);
  protected readonly busy = signal(false);

  protected async importCards(): Promise<void> {
    this.busy.set(true);
    try {
      const imported = await this.#storage.importGuestData({ clearAfter: this.clearAfter() });
      this.#notify.success(this.#transloco.translate('profile.import.done', { count: imported }));
      this.count.set(this.#storage.guestCardCount());
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected discard(): void {
    this.#storage.clearGuestData();
    this.count.set(0);
  }
}
