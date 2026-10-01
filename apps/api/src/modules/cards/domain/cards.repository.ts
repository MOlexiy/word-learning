import type {
  CardImage,
  CardInput,
  CardWordForms,
  DraftInput,
  RandomProgress,
  WordCardSummary,
} from '@wl/shared';

export interface CardRecord extends CardInput {
  id: string;
  userId: string;
  k: number;
  imageUrl: string | null;
  imageAuthor: string | null;
  imagePageUrl: string | null;
  imageHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportedCard extends CardInput {
  k: number;
  image: CardImage | null;
  imageHidden: boolean;
  progress?: RandomProgress;
}

/** Порт сховища карток. Реалізація — infrastructure/prisma-cards.repository.ts */
export abstract class CardsRepository {
  abstract listSummaries(userId: string): Promise<WordCardSummary[]>;
  /** Пошук `q` по name, n, v, adj, adv (без урахування регістру), впорядкований за релевантністю. */
  abstract search(userId: string, q: string): Promise<WordCardSummary[]>;
  /** Картки, де `word` трапляється в назві чи формах слова — кандидати для перевірки дублікатів. */
  abstract findWordFormCandidates(userId: string, word: string): Promise<CardWordForms[]>;
  /** Назви й форми всіх карток — для перевірки цілого списку слів за один запит. */
  abstract listWordForms(userId: string): Promise<CardWordForms[]>;
  abstract findById(id: string): Promise<CardRecord | null>;
  /** `fromDraftId` — чернетка власника, яка видаляється в тій самій транзакції. */
  abstract create(userId: string, input: CardInput, fromDraftId?: string): Promise<CardRecord>;
  abstract update(id: string, input: CardInput): Promise<CardRecord>;
  abstract delete(id: string): Promise<void>;
  /** Атомарний інкремент лічильника відкриттів `k`. */
  abstract incrementViews(id: string): Promise<CardRecord>;
  abstract appendTopic(id: string, text: string): Promise<CardRecord>;
  abstract setTopics(id: string, topics: string[]): Promise<CardRecord>;
  /** `null` — прибрати картинку і позначити, що автопідбір не потрібен. */
  abstract setImage(id: string, image: CardImage | null): Promise<CardRecord>;
  /**
   * В одній транзакції: обирає випадкову доступну картку (`lockedUntil <= now` або без прогресу)
   * і зберігає новий прогрес, обчислений доменною функцією `advance`.
   */
  abstract drawRandom(
    userId: string,
    now: Date,
    advance: (current: RandomProgress | null) => RandomProgress,
  ): Promise<string | null>;
  abstract nextUnlockAt(userId: string): Promise<Date | null>;
  abstract importMany(
    userId: string,
    cards: ImportedCard[],
    drafts: DraftInput[],
  ): Promise<{ cards: number; drafts: number }>;
}
