import { Injectable, signal } from '@angular/core';
import type { TranslateParams } from '../i18n/i18n.config';

export interface ConfirmOptions {
  /** i18n-ключ заголовка. */
  titleKey: string;
  /** i18n-ключ пояснення. */
  messageKey?: string;
  params?: TranslateParams;
  /** Текст-цитата (напр. уривок параграфа), показується як є — без перекладу. */
  quote?: string;
  /** i18n-ключ кнопки підтвердження (за замовчуванням «Видалити»). */
  confirmKey?: string;
  /** Небезпечна дія: червона кнопка підтвердження. */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Спливаюче вікно підтвердження: `await confirm.ask({...})` → true («Видалити») або false
 * («Скасувати», Esc, клік поза вікном). Одночасно відкрите лише одне вікно.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly #pending = signal<PendingConfirm | null>(null);
  readonly pending = this.#pending.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this.#pending()?.resolve(false);
    return new Promise<boolean>((resolve) =>
      this.#pending.set({ confirmKey: 'confirm.delete', ...options, resolve }),
    );
  }

  settle(confirmed: boolean): void {
    const pending = this.#pending();
    if (!pending) return;
    this.#pending.set(null);
    pending.resolve(confirmed);
  }
}
