import { computed, Injectable, signal } from '@angular/core';

/** Через скільки мс запит до API вважається «повільним» — схоже на холодний старт бекенда. */
export const SLOW_REQUEST_MS = 2500;

/**
 * Стан зв'язку з API. Безкоштовний Render присипляє сервіс після 15 хв простою, і перший запит чекає ~хвилину.
 * `waking()` — хоча б один запит до API висить довше за SLOW_REQUEST_MS (разом із повторами після 502/503/504).
 */
@Injectable({ providedIn: 'root' })
export class ServerStatusService {
  readonly #slowRequests = signal(0);
  readonly #since = signal<number | null>(null);

  readonly waking = computed(() => this.#slowRequests() > 0);
  /** Коли почав висіти найперший із повільних запитів (для лічильника секунд). */
  readonly since = this.#since.asReadonly();

  beginSlow(startedAt: number): void {
    if (this.#slowRequests() === 0) this.#since.set(startedAt);
    this.#slowRequests.update((n) => n + 1);
  }

  endSlow(): void {
    this.#slowRequests.update((n) => Math.max(0, n - 1));
    if (this.#slowRequests() === 0) this.#since.set(null);
  }
}
