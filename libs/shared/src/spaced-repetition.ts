/**
 * Кастомний інтервальний рандом.
 *
 * Для кожної картки зберігається `n` — крок, який буде застосовано при НАСТУПНОМУ випаданні
 * через «Рандом», та `lockedUntil` — момент, до якого картка не бере участі у вибірці.
 *
 *   1. Випала картка з кроком n  →  daysToLock = 5 * n  (n=1 → 5 днів … n=6 → 30 днів)
 *   2. lockedUntil = now + daysToLock
 *   3. n = n + 1;  якщо n > 6 → n = 1
 *
 * Картка, що жодного разу не випадала в рандомі, прогресу не має і вважається кроком 1.
 * Модуль не має залежностей і однаково працює в браузері (гість, LocalStorage) та на сервері (БД).
 */

export const REPETITION_MIN_STEP = 1;
export const REPETITION_MAX_STEP = 6;
export const LOCK_DAYS_PER_STEP = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Прогрес картки у форматі, що зберігається в LocalStorage (`lockedUntil` — ISO-8601). */
export interface RandomProgress {
  n: number;
  lockedUntil: string;
}

/** Структура LocalStorage для гостя: `{ [cardId]: { n, lockedUntil } }`. */
export type RandomProgressMap = Record<string, RandomProgress>;

/** Будь-яке «зламане» значення кроку (NaN, 0, 7, 3.5) приводимо до валідного діапазону 1..6. */
export function normalizeStep(step: number | undefined | null): number {
  if (typeof step !== 'number' || !Number.isInteger(step)) return REPETITION_MIN_STEP;
  if (step < REPETITION_MIN_STEP || step > REPETITION_MAX_STEP) return REPETITION_MIN_STEP;
  return step;
}

export function lockDaysForStep(step: number): number {
  return LOCK_DAYS_PER_STEP * normalizeStep(step);
}

export function nextStep(step: number): number {
  const current = normalizeStep(step);
  return current >= REPETITION_MAX_STEP ? REPETITION_MIN_STEP : current + 1;
}

/** Картка доступна, якщо ще не випадала або її блокування вже минуло (`lockedUntil <= now`). */
export function isCardAvailable(progress: RandomProgress | undefined | null, now: Date): boolean {
  if (!progress) return true;
  const lockedUntil = Date.parse(progress.lockedUntil);
  // Пошкоджена дата не повинна «назавжди» ховати картку.
  if (Number.isNaN(lockedUntil)) return true;
  return lockedUntil <= now.getTime();
}

/** Обчислює новий прогрес після того, як картка випала в рандомі. Чиста функція. */
export function advanceProgress(progress: RandomProgress | undefined | null, now: Date): RandomProgress {
  const step = normalizeStep(progress?.n);
  const lockedUntil = new Date(now.getTime() + lockDaysForStep(step) * MS_PER_DAY);
  return { n: nextStep(step), lockedUntil: lockedUntil.toISOString() };
}

/** Рівномірно обирає випадковий елемент. `random` інжектиться для детермінованих тестів. */
export function pickRandom<T>(items: readonly T[], random: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] ?? null;
}

/** Вибірка лише серед доступних карток (для гостьового режиму; на сервері те саме робить SQL). */
export function pickRandomAvailableId(
  cardIds: readonly string[],
  progress: RandomProgressMap,
  now: Date,
  random: () => number = Math.random,
): string | null {
  const available = cardIds.filter((id) => isCardAvailable(progress[id], now));
  return pickRandom(available, random);
}

/** Найближчий момент, коли хоча б одна з карток знову стане доступною (для підказки в UI). */
export function nextUnlockAt(cardIds: readonly string[], progress: RandomProgressMap): string | null {
  let min: number | null = null;
  for (const id of cardIds) {
    const entry = progress[id];
    if (!entry) continue;
    const time = Date.parse(entry.lockedUntil);
    if (!Number.isNaN(time) && (min === null || time < min)) min = time;
  }
  return min === null ? null : new Date(min).toISOString();
}
