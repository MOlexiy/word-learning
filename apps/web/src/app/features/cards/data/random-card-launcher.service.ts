import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { formatDateTime } from '../../../core/format';
import { ErrorTranslator } from '../../../core/i18n/error-translator.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { CardStorageService } from './card-storage.service';

/** Кнопка «Рандомне слово» у хедері. */
@Injectable({ providedIn: 'root' })
export class RandomCardLauncher {
  readonly #storage = inject(CardStorageService);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #language = inject(LanguageService);
  readonly #errors = inject(ErrorTranslator);

  readonly busy = signal(false);

  async open(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const { cardId, nextAvailableAt } = await this.#storage.drawRandom();
      if (cardId) {
        await this.#router.navigate(['/cards', cardId]);
      } else if (nextAvailableAt) {
        const date = formatDateTime(nextAvailableAt, this.#language.locale());
        this.#notify.info(this.#transloco.translate('cards.random.paused', { date }));
      } else {
        this.#notify.info(this.#transloco.translate('cards.random.empty'));
      }
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }
}
