import type {
  CardDuplicateCheck,
  CardImage,
  CardInput,
  RandomPickResult,
  WordCard,
  WordCardSummary,
} from '@wl/shared';

export interface CreateCardOptions {
  /** Картка з чернетки: чернетка видаляється разом зі створенням картки. */
  fromDraftId?: string;
}

/** Єдиний контракт роботи з картками — і для гостя (LocalStorage), і для акаунта (API). */
export interface CardsRepository {
  /** Без `q` — увесь каталог; з ним — пошук по name, n, v, adj, adv (показується лише name). */
  list(q?: string): Promise<WordCardSummary[]>;
  /** Без побічних ефектів. */
  get(id: string): Promise<WordCard>;
  /** Відкриття детальної сторінки: k + 1. */
  view(id: string): Promise<WordCard>;
  /** Чи є картка з такою назвою (`exact`) або з цим словом у формах інших карток (`related`). */
  checkDuplicates(name: string): Promise<CardDuplicateCheck>;
  /** Картку з назвою, що вже є, не створює: CardExistsError. */
  create(input: CardInput, options?: CreateCardOptions): Promise<WordCard>;
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

/** Картка з такою назвою вже є (API: 409 CARD_EXISTS). */
export class CardExistsError extends Error {
  constructor(
    readonly cardId: string,
    readonly cardName: string,
  ) {
    super('errors.CARD_EXISTS');
  }
}
