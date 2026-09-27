import { z } from 'zod';
import { REPETITION_MAX_STEP, REPETITION_MIN_STEP } from '../spaced-repetition';

const optionalText = (max: number) => z.string().trim().max(max).default('');

export const topicParagraphSchema = z.string().trim().min(1, 'validation.topicEmpty').max(10_000);

/**
 * Поля картки, які задає користувач. Використовується і для створення (POST), і для
 * редагування (PUT — повна заміна всього, крім `id` та службового лічильника `k`).
 */
export const cardInputSchema = z.object({
  name: z.string().trim().min(1, 'validation.nameRequired').max(200),
  means: optionalText(2_000),
  used: optionalText(4_000),
  n: optionalText(200),
  v: optionalText(200),
  adj: optionalText(200),
  adv: optionalText(200),
  collocations: optionalText(4_000),
  topic: z.array(topicParagraphSchema).max(500).default([]),
});
export type CardInput = z.infer<typeof cardInputSchema>;
/** Те, що фронт може надіслати (дефолти ще не застосовані). */
export type CardInputRaw = z.input<typeof cardInputSchema>;

export const addTopicSchema = z.object({ text: topicParagraphSchema });
export type AddTopicRequest = z.infer<typeof addTopicSchema>;

/**
 * Видалення параграфа за індексом. `text` — очікуваний вміст: якщо список параграфів тим часом
 * змінився (інша вкладка), сервер відмовить (TOPIC_CHANGED), а не видалить не той параграф.
 */
export const removeTopicSchema = z.object({ text: z.string().max(10_000) });
export type RemoveTopicRequest = z.infer<typeof removeTopicSchema>;

export const randomProgressSchema = z.object({
  n: z.number().int().min(REPETITION_MIN_STEP).max(REPETITION_MAX_STEP),
  lockedUntil: z.iso.datetime({ offset: true }),
});

/** Перенесення гостьових даних з LocalStorage в акаунт. */
export const importCardsSchema = z.object({
  cards: z
    .array(
      cardInputSchema.extend({
        /** Локальний id — потрібен лише щоб зіставити прогрес; на сервері генерується новий. */
        id: z.string().min(1).max(100),
        k: z.number().int().min(0).default(0),
      }),
    )
    .max(5_000),
  progress: z.record(z.string(), randomProgressSchema).default({}),
});
export type ImportCardsRequest = z.infer<typeof importCardsSchema>;

export interface WordCard {
  id: string;
  /** null — картка гостя (LocalStorage). */
  userId: string | null;
  name: string;
  means: string;
  used: string;
  n: string;
  v: string;
  adj: string;
  adv: string;
  collocations: string;
  topic: string[];
  /** Скільки разів картку відкривали. */
  k: number;
  createdAt: string;
  updatedAt: string;
}

/** У каталозі на картці показується лише `name`. */
export type WordCardSummary = Pick<WordCard, 'id' | 'name'>;

export interface RandomPickResult {
  /** null — доступних карток немає. */
  cardId: string | null;
  /** Коли найближча заблокована картка знову стане доступною (якщо cardId === null). */
  nextAvailableAt: string | null;
}

export interface ImportCardsResult {
  imported: number;
}
