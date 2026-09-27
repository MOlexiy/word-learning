import { z } from 'zod';

/**
 * Ілюстрація до «Прикладу вживання». У БД зберігається лише посилання на CDN Pexels
 * (кілька сотень байт), сам файл — ні. Хости обмежені, щоб у картку не можна було підкласти
 * довільний URL.
 */
export const cardImageSchema = z.object({
  url: z.url().startsWith('https://images.pexels.com/').max(500),
  author: z.string().trim().max(200).default(''),
  pageUrl: z.url().startsWith('https://www.pexels.com/').max(500),
});
export type CardImage = z.infer<typeof cardImageSchema>;

/** PUT /cards/:id/image. `null` — користувач прибрав картинку (автопідбір більше не спрацює). */
export const setCardImageSchema = z.object({ image: cardImageSchema.nullable() });
export type SetCardImageRequest = z.infer<typeof setCardImageSchema>;

export const imageSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  page: z.coerce.number().int().min(1).max(20).default(1),
});
export type ImageSearchQuery = z.infer<typeof imageSearchQuerySchema>;

export interface ImageSearchResult {
  images: CardImage[];
}

/** Службові слова, які лише заважають пошуку фото за реченням. */
const STOP_WORDS = new Set(
  (
    'a an the and or but if then than so as at by for from in into of off on onto out over to up ' +
    'with without about after before under again very too also just only not no nor ' +
    'i me my mine we us our ours you your yours he him his she her hers it its they them their theirs ' +
    'this that these those there here who whom whose which what when where why how ' +
    'is am are was were be been being do does did doing done have has had having ' +
    'will would shall should can could may might must ought ' +
    "i'm i've i'll i'd you're you've we're we've they're they've he's she's it's that's there's " +
    "don't doesn't didn't isn't aren't wasn't weren't can't couldn't won't wouldn't shouldn't " +
    'some any each every all both few more most other such own same one ones something anything ' +
    'let lets get got gets really always never often sometimes yesterday today tomorrow now still yet'
  ).split(' '),
);

/**
 * Пошуковий запит до фотостоку з прикладу вживання: перше речення без службових слів,
 * до 4 значущих слів. «We divided the pizza.» → «divided pizza». Порожній приклад → саме слово.
 */
export function buildImageQuery(example: string, word: string): string {
  const firstSentence =
    example
      .split(/\n+/)
      .map((line) => line.trim())
      .find(Boolean)
      ?.split(/(?<=[.!?])\s+/)[0] ?? '';
  const words = (firstSentence.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []).filter(
    (w) => w.length > 2 && !STOP_WORDS.has(w),
  );
  const unique = [...new Set(words)].slice(0, 4);
  return (unique.length ? unique.join(' ') : word.trim()).slice(0, 100);
}
