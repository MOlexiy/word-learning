import type { CardImage, CardInput, RandomProgress, WordCardSummary } from '@wl/shared';

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
  abstract findById(id: string): Promise<CardRecord | null>;
  abstract create(userId: string, input: CardInput): Promise<CardRecord>;
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
  abstract importMany(userId: string, cards: ImportedCard[]): Promise<number>;
}
