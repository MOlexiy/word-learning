import { computed, inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../auth/auth.service';
import { NotifyService } from '../notify/notify.service';

/**
 * «Поділитися з вчителем». Посилання веде на вже наявні read-only сторінки вчителя
 * (/students/:username/…), тож жодних публічних токенів: відкрити його може лише вчитель,
 * який прийняв учня (перевіряє API). Гість отримає логін і повернеться на посилання.
 *
 * На телефоні — системне меню «Поділитися» (Telegram, Viber…), на десктопі — копіювання в буфер.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  readonly #auth = inject(AuthService);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);

  /** Ділитися є з ким: учень з підтвердженим вчителем. */
  readonly canShareWithTeacher = computed(() => {
    const user = this.#auth.user();
    return user?.role === 'student' && user.teacher?.status === 'accepted';
  });

  shareCard(cardId: string, word: string): Promise<void> {
    return this.#share(`/students/${this.#me()}/cards/${encodeURIComponent(cardId)}`, word);
  }

  shareDraft(draftId: string, word: string): Promise<void> {
    const params = new URLSearchParams({ view: 'inbox', draft: draftId });
    return this.#share(`/students/${this.#me()}?${params}`, word);
  }

  #me(): string {
    return encodeURIComponent(this.#auth.user()?.username ?? '');
  }

  async #share(path: string, word: string): Promise<void> {
    const url = new URL(path, document.baseURI).toString();
    const title = this.#transloco.translate('share.title', { word });
    const touch = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
    if (touch && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (error: unknown) {
        // Користувач закрив меню — нічого не робимо; інша помилка — пробуємо буфер.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      this.#notify.success(this.#transloco.translate('share.copied'));
    } catch {
      this.#notify.info(this.#transloco.translate('share.manual', { url }), { ttl: 15000 });
    }
  }
}
