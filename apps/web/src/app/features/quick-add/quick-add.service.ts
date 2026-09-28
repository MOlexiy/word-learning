import { Injectable, signal } from '@angular/core';

/** Куди зберігати швидке слово: у власну чернетку чи в чернетку учня (вчитель). */
export type QuickAddTarget = { kind: 'self' } | { kind: 'student'; username: string };

/**
 * Вікно «Швидко зберегти слово» (кнопка «+» у хедері).
 * Коли вчитель переглядає картки учня, сторінка учня виставляє `studentContext`,
 * і той самий «+» додає слово вже учню.
 */
@Injectable({ providedIn: 'root' })
export class QuickAddService {
  readonly #target = signal<QuickAddTarget | null>(null);
  /** null — вікно закрите. */
  readonly target = this.#target.asReadonly();

  /** Username учня, чиї картки зараз відкриті у вчителя. */
  readonly studentContext = signal<string | null>(null);

  /** Лічильник збережень у чернетку учня — сторінка учня за ним перезавантажує список. */
  readonly #studentSaves = signal(0);
  readonly studentSaves = this.#studentSaves.asReadonly();

  open(target?: QuickAddTarget): void {
    const student = this.studentContext();
    this.#target.set(target ?? (student ? { kind: 'student', username: student } : { kind: 'self' }));
  }

  close(): void {
    this.#target.set(null);
  }

  notifyStudentSaved(): void {
    this.#studentSaves.update((n) => n + 1);
  }
}
