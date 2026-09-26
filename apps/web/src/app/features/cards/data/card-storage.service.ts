import { computed, inject, Injectable } from '@angular/core';
import type { CardInput, RandomPickResult, WordCard, WordCardSummary } from '@wl/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiCardsRepository } from './api-cards.repository';
import type { CardsRepository } from './cards.repository';
import { LocalCardsRepository } from './local-cards.repository';

export type StorageMode = 'guest' | 'account';

/**
 * StorageService: компоненти працюють лише з ним і не знають, де лежать дані.
 * Стратегія обирається реактивно від стану авторизації: гість → LocalStorage, користувач → API.
 */
@Injectable({ providedIn: 'root' })
export class CardStorageService implements CardsRepository {
  readonly #auth = inject(AuthService);
  readonly #local = inject(LocalCardsRepository);
  readonly #api = inject(ApiCardsRepository);

  readonly mode = computed<StorageMode>(() => (this.#auth.isAuthenticated() ? 'account' : 'guest'));
  readonly #repo = computed<CardsRepository>(() => (this.mode() === 'account' ? this.#api : this.#local));

  list(): Promise<WordCardSummary[]> {
    return this.#repo().list();
  }

  get(id: string): Promise<WordCard> {
    return this.#repo().get(id);
  }

  view(id: string): Promise<WordCard> {
    return this.#repo().view(id);
  }

  create(input: CardInput): Promise<WordCard> {
    return this.#repo().create(input);
  }

  update(id: string, input: CardInput): Promise<WordCard> {
    return this.#repo().update(id, input);
  }

  addTopic(id: string, text: string): Promise<WordCard> {
    return this.#repo().addTopic(id, text);
  }

  remove(id: string): Promise<void> {
    return this.#repo().remove(id);
  }

  drawRandom(): Promise<RandomPickResult> {
    return this.#repo().drawRandom();
  }

  /** Скільки гостьових карток лежить у браузері (для екрану перенесення в акаунт). */
  guestCardCount(): number {
    return this.#local.count();
  }

  /** Переносить гостьові картки з інтервалами в БД. */
  async importGuestData({ clearAfter }: { clearAfter: boolean }): Promise<number> {
    const payload = this.#local.exportForImport();
    if (!payload.cards.length) return 0;
    const { imported } = await this.#api.import(payload);
    if (clearAfter) this.#local.clear();
    return imported;
  }

  clearGuestData(): void {
    this.#local.clear();
  }
}
