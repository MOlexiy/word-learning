// Тести запускаються на зібраному CJS-бандлі: `npm test -w @wl/shared` (після build).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  findCardDuplicates,
  parseBulkDrafts,
  searchCards,
  wordFormTokens,
  cardSearchQuerySchema,
} = require('../dist/cjs/index.js');

const card = (id, name, forms = {}) => ({ id, name, n: '', v: '', adj: '', adv: '', ...forms });

const cards = [
  card('1', 'run', { n: 'runner, running', v: 'to run' }),
  card('2', 'rerun'),
  card('3', 'fast', { adv: 'fast' }),
  card('4', 'Runway'),
  card('5', 'quick', { adv: 'quickly; (informal) quick' }),
];

describe('cardSearchQuerySchema', () => {
  it('q обрізається; зайві параметри ігноруються', () => {
    assert.deepEqual(cardSearchQuerySchema.parse({ q: '  run ', fields: 'v' }), { q: 'run' });
    assert.deepEqual(cardSearchQuerySchema.parse({}), { q: '' });
  });
});

describe('searchCards', () => {
  it('шукає в name, n, v, adj, adv; спершу префікс назви, далі вміст назви, далі форми', () => {
    assert.deepEqual(
      searchCards(cards, 'run').map((c) => c.name),
      ['run', 'Runway', 'rerun'],
    );
  });
  it('збіг лише у формі слова теж знаходить картку', () => {
    assert.deepEqual(searchCards(cards, 'RUNNER'), [cards[0]]);
    assert.deepEqual(
      searchCards(cards, 'quickly').map((c) => c.id),
      ['5'],
    );
  });
  it('порожній запит — увесь каталог за алфавітом', () => {
    assert.equal(searchCards(cards, '  ').length, cards.length);
  });
});

describe('findCardDuplicates', () => {
  it('точний збіг назви (регістр, пробіли, «to»)', () => {
    assert.deepEqual(findCardDuplicates('  RUN ', cards).exact, { id: '1', name: 'run' });
    assert.deepEqual(findCardDuplicates('to run', cards).exact, { id: '1', name: 'run' });
  });
  it('збіг лише з формами слова → related з полями', () => {
    const result = findCardDuplicates('running', cards);
    assert.equal(result.exact, null);
    assert.deepEqual(result.related, [{ id: '1', name: 'run', fields: ['n'] }]);
  });
  it('картка з точним збігом не дублюється в related', () => {
    const result = findCardDuplicates('fast', cards);
    assert.deepEqual(result.exact, { id: '3', name: 'fast' });
    assert.deepEqual(result.related, []);
  });
  it('частина слова — не дублікат', () => {
    assert.deepEqual(findCardDuplicates('runn', cards), { exact: null, related: [] });
  });
  it('токени форм: роздільники, дужки, частки', () => {
    assert.deepEqual(wordFormTokens('quickly; (informal) quick'), ['quickly', 'quick']);
    assert.deepEqual(wordFormTokens('to run / a runner'), ['run', 'runner']);
  });
});

describe('parseBulkDrafts', () => {
  it('коми, нові рядки, повтори', () => {
    assert.deepEqual(parseBulkDrafts('run, walk\njump;  Run \n\n'), [
      { word: 'run', meaning: '' },
      { word: 'walk', meaning: '' },
      { word: 'jump', meaning: '' },
    ]);
  });
  it('рядок з роздільником — слово зі значенням (коми в значенні дозволені)', () => {
    assert.deepEqual(parseBulkDrafts('run - бігти, тікати\nwell-known: відомий\n• get over — подолати'), [
      { word: 'run', meaning: 'бігти, тікати' },
      { word: 'well-known', meaning: 'відомий' },
      { word: 'get over', meaning: 'подолати' },
    ]);
  });
  it('нумеровані списки', () => {
    assert.deepEqual(
      parseBulkDrafts('1. apple\n2) pear').map((d) => d.word),
      ['apple', 'pear'],
    );
  });
});
