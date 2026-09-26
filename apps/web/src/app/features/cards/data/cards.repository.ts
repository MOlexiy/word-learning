import type { CardInput, RandomPickResult, WordCard, WordCardSummary } from '@wl/shared';

/** Єдиний контракт роботи з картками — і для гостя (LocalStorage), і для акаунта (API). */
export interface CardsRepository {
  list(): Promise<WordCardSummary[]>;
  /** Без побічних ефектів. */
  get(id: string): Promise<WordCard>;
  /** Відкриття детальної сторінки: k + 1. */
  view(id: string): Promise<WordCard>;
  create(input: CardInput): Promise<WordCard>;
  update(id: string, input: CardInput): Promise<WordCard>;
  addTopic(id: string, text: string): Promise<WordCard>;
  remove(id: string): Promise<void>;
  /** Випадкова доступна картка + постановка на таймер 5·n днів. */
  drawRandom(): Promise<RandomPickResult>;
}

export class CardNotFoundError extends Error {
  constructor(readonly cardId: string) {
    super('errors.CARD_NOT_FOUND');
  }
}
