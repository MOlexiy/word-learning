import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { CardInput } from '@wl/shared';
import { ErrorTranslator } from '../../../core/i18n/error-translator.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { CardStorageService } from '../data/card-storage.service';
import { CardFormComponent } from '../ui/card-form.component';

@Component({
  selector: 'wl-card-create-page',
  imports: [CardFormComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ 'cards.create.title' | transloco }}</h1>
    <section class="panel">
      <wl-card-form
        mode="create"
        submitLabel="cards.create.submit"
        [busy]="busy()"
        (saved)="create($event)"
      />
    </section>
  `,
})
export class CardCreatePage {
  readonly #storage = inject(CardStorageService);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);
  protected readonly busy = signal(false);

  protected async create(input: CardInput): Promise<void> {
    this.busy.set(true);
    try {
      const card = await this.#storage.create(input);
      this.#notify.success(this.#transloco.translate('cards.create.created', { name: card.name }));
      await this.#router.navigate(['/cards', card.id], { replaceUrl: true });
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }
}
