// Тести запускаються на зібраному CJS-бандлі: `npm test -w @wl/shared` (після build).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  advanceProgress,
  isCardAvailable,
  nextUnlockAt,
  pickRandomAvailableId,
  cardInputSchema,
} = require('../dist/cjs/index.js');

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-01-01T00:00:00.000Z');

describe('advanceProgress', () => {
  it('нова картка: блок на 5 днів, наступний крок 2', () => {
    assert.deepEqual(advanceProgress(undefined, now), {
      n: 2,
      lockedUntil: new Date(now.getTime() + 5 * DAY).toISOString(),
    });
  });

  it('повний цикл 5,10,15,20,25,30 днів і скидання на 1', () => {
    let progress;
    const days = [];
    for (let i = 0; i < 7; i++) {
      progress = advanceProgress(progress, now);
      days.push((Date.parse(progress.lockedUntil) - now.getTime()) / DAY);
    }
    assert.deepEqual(days, [5, 10, 15, 20, 25, 30, 5]);
    assert.equal(progress.n, 2);
  });

  it('некоректний крок (7, 0, NaN, 2.5) трактується як 1', () => {
    for (const n of [7, 0, Number.NaN, 2.5]) {
      assert.equal(advanceProgress({ n, lockedUntil: now.toISOString() }, now).n, 2);
    }
  });
});

describe('isCardAvailable', () => {
  it('без прогресу — доступна', () => assert.equal(isCardAvailable(undefined, now), true));
  it('lockedUntil == now — доступна', () =>
    assert.equal(isCardAvailable({ n: 2, lockedUntil: now.toISOString() }, now), true));
  it('lockedUntil у майбутньому — недоступна', () =>
    assert.equal(
      isCardAvailable({ n: 2, lockedUntil: new Date(now.getTime() + 1).toISOString() }, now),
      false,
    ));
  it('пошкоджена дата не блокує картку', () =>
    assert.equal(isCardAvailable({ n: 2, lockedUntil: 'oops' }, now), true));
});

describe('pickRandomAvailableId', () => {
  const progress = {
    a: { n: 3, lockedUntil: new Date(now.getTime() + DAY).toISOString() },
    b: { n: 2, lockedUntil: new Date(now.getTime() - DAY).toISOString() },
  };

  it('обирає лише серед доступних', () => {
    const picks = new Set(
      [0, 0.49, 0.99].map((r) => pickRandomAvailableId(['a', 'b', 'c'], progress, now, () => r)),
    );
    assert.deepEqual(picks, new Set(['b', 'c']));
  });

  it('null, якщо все заблоковано + підказка про найближче розблокування', () => {
    assert.equal(pickRandomAvailableId(['a'], progress, now), null);
    assert.equal(nextUnlockAt(['a'], progress), progress.a.lockedUntil);
  });
});

describe('cardInputSchema', () => {
  it('заповнює дефолти і тримить значення', () => {
    const card = cardInputSchema.parse({ name: '  run ', topic: [' He runs. '] });
    assert.equal(card.name, 'run');
    assert.equal(card.means, '');
    assert.deepEqual(card.topic, ['He runs.']);
  });

  it('вимагає name', () => assert.equal(cardInputSchema.safeParse({ name: '   ' }).success, false));
});
