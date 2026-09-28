import { z } from 'zod';
import { normalizeCardName } from '../card-search';

/**
 * Чернетка («Inbox»): швидко збережене слово з необов'язковим коротким значенням,
 * яке пізніше перетворюється на повну картку.
 */
export const DRAFT_MEANING_MAX = 500;
export const DRAFTS_PER_REQUEST_MAX = 200;

export const draftInputSchema = z.object({
  word: z.string().trim().min(1, 'validation.nameRequired').max(200),
  meaning: z.string().trim().max(DRAFT_MEANING_MAX).default(''),
});
export type DraftInput = z.infer<typeof draftInputSchema>;
export type DraftInputRaw = z.input<typeof draftInputSchema>;

/** Одне слово чи цілий список (Bulk Add) — один ендпоінт. */
export const addDraftsSchema = z.object({
  items: z.array(draftInputSchema).min(1, 'validation.nameRequired').max(DRAFTS_PER_REQUEST_MAX),
});
export type AddDraftsRequest = z.infer<typeof addDraftsSchema>;

export interface WordDraft {
  id: string;
  word: string;
  meaning: string;
  /** Username вчителя, який додав слово учню; null — учень сам. */
  addedBy: string | null;
  createdAt: string;
}

export interface SkippedDraft {
  word: string;
  /** `draft` — вже є в чернетці; `card` — вже є картка з такою назвою. */
  reason: 'draft' | 'card';
  /** Для `card`: id наявної картки. */
  cardId?: string;
}

export interface AddDraftsResult {
  created: WordDraft[];
  skipped: SkippedDraft[];
}

/** Роздільник «слово — значення» у рядку Bulk Add: « - », « — », « – », табуляція або двокрапка. */
const MEANING_SEPARATOR = /\s+[-–—]\s+|\t|:\s*/;

/**
 * Розбирає текст Bulk Add.
 *  - кожен рядок з роздільником (`run - бігти`, `run: бігти`) — одне слово зі значенням;
 *  - рядок без роздільника — список слів через кому / крапку з комою;
 *  - повтори (без урахування регістру) відкидаються.
 */
export function parseBulkDrafts(text: string): DraftInput[] {
  const seen = new Set<string>();
  const result: DraftInput[] = [];
  const push = (word: string, meaning = '') => {
    const cleanWord = word.trim().replace(/\s+/g, ' ').slice(0, 200);
    const key = normalizeCardName(cleanWord);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push({ word: cleanWord, meaning: meaning.trim().slice(0, DRAFT_MEANING_MAX) });
  };
  for (const rawLine of text.split(/\r?\n/)) {
    // Маркери списків, скопійованих з нотаток: «- run», «• run», «1. run», «2) run».
    const line = rawLine.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, '');
    if (!line) continue;
    const separator = line.match(MEANING_SEPARATOR);
    if (separator?.index) {
      push(line.slice(0, separator.index), line.slice(separator.index + separator[0].length));
    } else {
      for (const word of line.split(/[,;]+/)) push(word);
    }
  }
  return result;
}
