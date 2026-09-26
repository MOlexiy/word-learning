import { inject, Injectable } from '@angular/core';
import { z } from 'zod';
import {
  advanceProgress,
  type CardInput,
  cardInputSchema,
  type ImportCardsRequest,
  nextUnlockAt,
  pickRandomAvailableId,
  type RandomPickResult,
  type RandomProgressMap,
  randomProgressSchema,
  topicParagraphSchema,
  type WordCard,
  type WordCardSummary,
} from '@wl/shared';
import { BrowserStorage } from '../../../core/browser/browser-storage';
import { CardNotFoundError, type CardsRepository } from './cards.repository';

export const GUEST_CARDS_KEY = 'wl.guest.cards';
/** Формат: `{ [cardId]: { n: number, lockedUntil: string } }` */
export const GUEST_PROGRESS_KEY = 'wl.guest.randomProgress';

const storedCardSchema = cardInputSchema.extend({
  id: z.string().min(1),
  userId: z.null().default(null),
  k: z.number().int().min(0).catch(0),
  createdAt: z.string().catch(() => new Date().toISOString()),
  updatedAt: z.string().catch(() => new Date().toISOString()),
});

/** Гостьовий режим: усі картки та інтервали — виключно в LocalStorage цього браузера. */
@Injectable({ providedIn: 'root' })
export class LocalCardsRepository implements CardsRepository {
  readonly #storage = inject(BrowserStorage);

  async list(): Promise<WordCardSummary[]> {
    return this.#readCards()
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<WordCard> {
    return this.#find(this.#readCards(), id);
  }

  async view(id: string): Promise<WordCard> {
    return this.#mutate(id, (card) => ({ ...card, k: card.k + 1 }), { touch: false });
  }

  async create(input: CardInput): Promise<WordCard> {
    const now = new Date().toISOString();
    const card: WordCard = { ...input, id: newId(), userId: null, k: 0, createdAt: now, updatedAt: now };
    this.#writeCards([...this.#readCards(), card]);
    return card;
  }

  async update(id: string, input: CardInput): Promise<WordCard> {
    return this.#mutate(id, (card) => ({ ...card, ...input }));
  }

  async addTopic(id: string, text: string): Promise<WordCard> {
    const paragraph = topicParagraphSchema.parse(text);
    return this.#mutate(id, (card) => ({ ...card, topic: [...card.topic, paragraph] }));
  }

  async remove(id: string): Promise<void> {
    this.#writeCards(this.#readCards().filter((card) => card.id !== id));
    const progress = this.#readProgress();
    delete progress[id];
    this.#writeProgress(progress);
  }

  async drawRandom(): Promise<RandomPickResult> {
    const ids = this.#readCards().map((card) => card.id);
    const progress = this.#readProgress();
    const now = new Date();

    const cardId = pickRandomAvailableId(ids, progress, now);
    if (!cardId) return { cardId: null, nextAvailableAt: nextUnlockAt(ids, progress) };

    progress[cardId] = advanceProgress(progress[cardId], now);
    this.#writeProgress(progress);
    return { cardId, nextAvailableAt: null };
  }

  count(): number {
    return this.#readCards().length;
  }

  /** Пакет для POST /api/cards/import. */
  exportForImport(): ImportCardsRequest {
    const cards = this.#readCards().map(({ userId: _userId, createdAt: _c, updatedAt: _u, ...card }) => card);
    const ids = new Set(cards.map((card) => card.id));
    const progress = Object.fromEntries(Object.entries(this.#readProgress()).filter(([id]) => ids.has(id)));
    return { cards, progress };
  }

  clear(): void {
    this.#storage.remove(GUEST_CARDS_KEY);
    this.#storage.remove(GUEST_PROGRESS_KEY);
  }

  #mutate(id: string, change: (card: WordCard) => WordCard, { touch = true } = {}): WordCard {
    const cards = this.#readCards();
    const current = this.#find(cards, id);
    const next = { ...change(current), ...(touch ? { updatedAt: new Date().toISOString() } : {}) };
    this.#writeCards(cards.map((card) => (card.id === id ? next : card)));
    return next;
  }

  #find(cards: WordCard[], id: string): WordCard {
    const card = cards.find((c) => c.id === id);
    if (!card) throw new CardNotFoundError(id);
    return card;
  }

  /** Биті записи (ручне редагування, стара версія) відкидаємо поштучно, а не всю колекцію. */
  #readCards(): WordCard[] {
    const raw = this.#storage.read(GUEST_CARDS_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item: unknown) => {
      const parsed = storedCardSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }

  #writeCards(cards: WordCard[]): void {
    if (!this.#storage.write(GUEST_CARDS_KEY, cards)) {
      throw new Error('errors.storageUnavailable');
    }
  }

  #readProgress(): RandomProgressMap {
    const raw = this.#storage.read(GUEST_PROGRESS_KEY);
    if (!raw || typeof raw !== 'object') return {};
    const result: RandomProgressMap = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const parsed = randomProgressSchema.safeParse(value);
      if (parsed.success) result[id] = parsed.data;
    }
    return result;
  }

  #writeProgress(progress: RandomProgressMap): void {
    this.#storage.write(GUEST_PROGRESS_KEY, progress);
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
