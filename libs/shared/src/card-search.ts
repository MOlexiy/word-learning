/**
 * Пошук і перевірка дублікатів карток. Спільна логіка для сервера (після SQL-префільтра)
 * і гостьового режиму (LocalStorage), тож обидва режими поводяться однаково.
 */

/** Поля, за якими API шукає в каталозі (вибору полів в інтерфейсі немає — шукається скрізь). */
export const CARD_SEARCH_FIELDS = ['name', 'n', 'v', 'adj', 'adv'] as const;
export type CardSearchField = (typeof CARD_SEARCH_FIELDS)[number];

/** Поля форм слова, з якими порівнюється `name` нової картки (крім самого `name`). */
export const CARD_WORD_FORM_FIELDS = ['n', 'v', 'adj', 'adv'] as const;
export type CardWordFormField = (typeof CARD_WORD_FORM_FIELDS)[number];

export const CARD_SEARCH_MAX_LENGTH = 200;

/** Мінімум полів картки, потрібний для пошуку та перевірки дублікатів. */
export type CardWordForms = { id: string; name: string } & Record<CardWordFormField, string>;

export function normalizeSearchText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

/**
 * Пошук у каталозі: `q` шукається в name, n, v, adj, adv (без урахування регістру).
 * Порядок: спершу назви, що починаються з запиту, далі — назви, що його містять,
 * далі — збіги лише у формах слова; усередині групи — за алфавітом.
 */
export function searchCards<T extends CardWordForms>(cards: readonly T[], q: string): T[] {
  const query = normalizeSearchText(q);
  if (!query) return [...cards].sort((a, b) => a.name.localeCompare(b.name));
  const rank = (card: T): number | null => {
    const name = normalizeSearchText(card.name);
    if (name.startsWith(query)) return 0;
    if (name.includes(query)) return 1;
    return CARD_WORD_FORM_FIELDS.some((f) => normalizeSearchText(card[f]).includes(query)) ? 2 : null;
  };
  return cards
    .flatMap((card) => {
      const r = rank(card);
      return r === null ? [] : [{ card, r }];
    })
    .sort((a, b) => a.r - b.r || a.card.name.localeCompare(b.card.name))
    .map(({ card }) => card);
}

/** Ведучі службові слова, які не роблять форму іншим словом: «to run», «a runner». */
const LEADING_PARTICLE = /^(?:to|a|an|the)\s+/;

/** «running, runner; (rare) runnable» → ['running', 'runner', 'runnable'] (нормалізовані). */
export function wordFormTokens(value: string): string[] {
  return value
    .split(/[,;/|\n]+|\s[-–—]\s/)
    .map((part) =>
      normalizeSearchText(part.replace(/\([^)]*\)/g, ' '))
        .replace(LEADING_PARTICLE, '')
        .replace(/[.!?]+$/, ''),
    )
    .filter(Boolean);
}

export function normalizeCardName(name: string): string {
  return normalizeSearchText(name).replace(LEADING_PARTICLE, '');
}

/** Чи це інше слово (а не та сама назва з іншим регістром / пробілами / «to»). */
export function isCardNameChanged(previous: string, next: string): boolean {
  return normalizeCardName(previous) !== normalizeCardName(next);
}

export interface CardDuplicateRelated {
  id: string;
  name: string;
  /** У яких полях знайдено слово. */
  fields: CardWordFormField[];
}

export interface CardDuplicateCheck {
  /** Картка з такою самою назвою — нову створити не можна. */
  exact: { id: string; name: string } | null;
  /** Слово вже записане як форма (n/v/adj/adv) інших карток — варто перепитати. */
  related: CardDuplicateRelated[];
}

/**
 * `name` порівнюється з назвами карток (`exact`) і з кожним варіантом у n / v / adj / adv
 * (`related`): «purposeful, all-purpose / multi-purpose» дає збіг і для «multi-purpose».
 * `excludeId` — картка, яку редагують: сама з собою вона не дублікат.
 */
export function findCardDuplicates(
  name: string,
  allCards: readonly CardWordForms[],
  excludeId?: string,
): CardDuplicateCheck {
  const target = normalizeCardName(name);
  if (!target) return { exact: null, related: [] };
  const cards = excludeId ? allCards.filter((card) => card.id !== excludeId) : allCards;
  const exactCard = cards.find((card) => normalizeCardName(card.name) === target);
  const related = cards.flatMap((card) => {
    if (card === exactCard) return [];
    const fields = CARD_WORD_FORM_FIELDS.filter((field) => wordFormTokens(card[field]).includes(target));
    return fields.length ? [{ id: card.id, name: card.name, fields }] : [];
  });
  return {
    exact: exactCard ? { id: exactCard.id, name: exactCard.name } : null,
    related: related.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Результат перевірки одного слова зі списку. */
export interface CardWordDuplicates extends CardDuplicateCheck {
  /** Слово так, як його надіслали. */
  word: string;
}

/** POST /cards/duplicates — лише слова, для яких щось знайшлося (порядок як у запиті). */
export interface CardDuplicatesBatchResult {
  items: CardWordDuplicates[];
}

/**
 * Перевірка списку слів (Bulk Add, швидке слово) за один прохід по картках.
 * Повтори (після нормалізації) перевіряються один раз; слова без збігів не повертаються.
 */
export function findDuplicatesForWords(
  words: readonly string[],
  cards: readonly CardWordForms[],
): CardWordDuplicates[] {
  const seen = new Set<string>();
  return words.flatMap((word) => {
    const key = normalizeCardName(word);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const check = findCardDuplicates(word, cards);
    return check.exact || check.related.length ? [{ word, ...check }] : [];
  });
}
