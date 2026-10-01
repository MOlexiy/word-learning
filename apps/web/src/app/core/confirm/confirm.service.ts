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
  /** i18n-ключ кнопки відмови (за замовчуванням «Скасувати»). */
  cancelKey?: string;
  /** i18n-ключ третьої кнопки (між відмовою і підтвердженням) — лише для `choose()`. */
  altKey?: string;
  /** Посилання, що відкриваються в новій вкладці (напр. схожі картки). Тексти — як є. */
  links?: readonly ConfirmLink[];
  /** Небезпечна дія: червона кнопка підтвердження. */
  danger?: boolean;
}

export interface ConfirmLink {
  label: string;
  /** Дрібний підпис поруч, напр. «n, v». */
  hint?: string;
  href: string;
}

/** `cancel` — також Esc і клік поза вікном. */
export type ConfirmChoice = 'confirm' | 'alt' | 'cancel';

interface PendingConfirm extends ConfirmOptions {
  resolve: (choice: ConfirmChoice) => void;
}

/**
 * Спливаюче вікно підтвердження: `await confirm.ask({...})` → true (кнопка підтвердження) або false
 * (кнопка відмови, Esc, клік поза вікном). `choose({ ..., altKey })` — те саме з третьою кнопкою.
 * Одночасно відкрите лише одне вікно.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly #pending = signal<PendingConfirm | null>(null);
  readonly pending = this.#pending.asReadonly();

  async ask(options: Omit<ConfirmOptions, 'altKey'>): Promise<boolean> {
    return (await this.choose(options)) === 'confirm';
  }

  choose(options: ConfirmOptions): Promise<ConfirmChoice> {
    this.#pending()?.resolve('cancel');
    return new Promise<ConfirmChoice>((resolve) =>
      this.#pending.set({ confirmKey: 'confirm.delete', cancelKey: 'confirm.cancel', ...options, resolve }),
    );
  }

  /** `true` / `false` — підтвердження / відмова (як раніше). */
  settle(choice: ConfirmChoice | boolean): void {
    const pending = this.#pending();
    if (!pending) return;
    this.#pending.set(null);
    pending.resolve(choice === true ? 'confirm' : choice === false ? 'cancel' : choice);
  }
}
