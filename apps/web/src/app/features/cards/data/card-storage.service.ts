import { computed, inject, Injectable } from '@angular/core';
import type {
  CardDuplicateCheck,
  CardImage,
  CardInput,
  RandomPickResult,
  WordCard,
  WordCardSummary,
} from '@wl/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiCardsRepository } from './api-cards.repository';
import type { CardsRepository, CreateCardOptions } from './cards.repository';
import { LocalCardsRepository } from './local-cards.repository';
import { LocalDraftsRepository } from './local-drafts.repository';

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
  readonly #localDrafts = inject(LocalDraftsRepository);

  readonly mode = computed<StorageMode>(() => (this.#auth.isAuthenticated() ? 'account' : 'guest'));
  readonly #repo = computed<CardsRepository>(() => (this.mode() === 'account' ? this.#api : this.#local));

  list(q?: string): Promise<WordCardSummary[]> {
    return this.#repo().list(q);
  }

  checkDuplicates(name: string): Promise<CardDuplicateCheck> {
    return this.#repo().checkDuplicates(name);
  }

  get(id: string): Promise<WordCard> {
    return this.#repo().get(id);
  }

  view(id: string): Promise<WordCard> {
    return this.#repo().view(id);
  }

  /** API видаляє чернетку в тій самій транзакції; у гостя — одразу після створення картки. */
  async create(input: CardInput, options: CreateCardOptions = {}): Promise<WordCard> {
    const card = await this.#repo().create(input, options);
    if (this.mode() === 'guest' && options.fromDraftId) await this.#localDrafts.remove(options.fromDraftId);
    return card;
  }

  update(id: string, input: CardInput): Promise<WordCard> {
    return this.#repo().update(id, input);
  }

  addTopic(id: string, text: string): Promise<WordCard> {
    return this.#repo().addTopic(id, text);
  }

  removeTopic(id: string, index: number, text: string): Promise<WordCard> {
    return this.#repo().removeTopic(id, index, text);
  }

  setImage(id: string, image: CardImage | null): Promise<WordCard> {
    return this.#repo().setImage(id, image);
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

  guestDraftCount(): number {
    return this.#localDrafts.count();
  }

  /** Переносить гостьові картки з інтервалами та чернетку в БД. */
  async importGuestData({ clearAfter }: { clearAfter: boolean }): Promise<{ cards: number; drafts: number }> {
    const payload = { ...this.#local.exportForImport(), drafts: this.#localDrafts.exportForImport() };
    if (!payload.cards.length && !payload.drafts.length) return { cards: 0, drafts: 0 };
    const { imported, importedDrafts } = await this.#api.import(payload);
    if (clearAfter) this.clearGuestData();
    return { cards: imported, drafts: importedDrafts };
  }

  clearGuestData(): void {
    this.#local.clear();
    this.#localDrafts.clear();
  }
}
