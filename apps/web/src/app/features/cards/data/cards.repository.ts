import type { CardImage, CardInput, RandomPickResult, WordCard, WordCardSummary } from '@wl/shared';

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
  /** Видаляє параграф `index`, якщо його текст досі `text` (інакше — помилка TOPIC_CHANGED). */
  removeTopic(id: string, index: number, text: string): Promise<WordCard>;
  /** Ілюстрація до прикладу вживання; `null` — прибрати і не підбирати автоматично. */
  setImage(id: string, image: CardImage | null): Promise<WordCard>;
  remove(id: string): Promise<void>;
  /** Випадкова доступна картка + постановка на таймер 5·n днів. */
  drawRandom(): Promise<RandomPickResult>;
}

export class CardNotFoundError extends Error {
  constructor(readonly cardId: string) {
    super('errors.CARD_NOT_FOUND');
  }
}
