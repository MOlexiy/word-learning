// Перевірка перекладів: `npm run i18n:check -w @wl/web`
//  1) ua.json і en.json мають однаковий набір ключів і не містять порожніх значень;
//  2) кожен статичний ключ, використаний у коді, існує;
//  3) є переклади для всіх кодів помилок API та всіх ключів validation.* зі спільних схем;
//  4) динамічні ключі (поля картки, ролі, статуси, мови) покриті.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const repo = join(root, '..', '..');
const LANGS = ['ua', 'en'];

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );

const dicts = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    new Map(flatten(JSON.parse(readFileSync(join(root, 'public', 'i18n', `${lang}.json`), 'utf8')))),
  ]),
);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });

const problems = [];
const [base, ...others] = LANGS;

for (const lang of LANGS) {
  for (const [key, value] of dicts[lang]) {
    if (typeof value !== 'string' || !value.trim()) problems.push(`${lang}.json: порожнє значення «${key}»`);
  }
}
for (const lang of others) {
  for (const key of dicts[base].keys())
    if (!dicts[lang].has(key)) problems.push(`${lang}.json: немає «${key}»`);
  for (const key of dicts[lang].keys())
    if (!dicts[base].has(key)) problems.push(`${base}.json: немає «${key}»`);
}

const namespaces = new Set([...dicts[base].keys()].map((k) => k.split('.')[0]));
const required = new Map();
const need = (key, where) => required.set(key, where);

// 2) статичні ключі в коді фронту: '<namespace>.<...>' у лапках
for (const file of walk(join(root, 'src'))) {
  const src = readFileSync(file, 'utf8');
  for (const [, key] of src.matchAll(/['"`]([a-z][A-Za-z]*(?:\.[A-Za-z0-9_]+)+)['"`]/g)) {
    if (namespaces.has(key.split('.')[0]) && !key.endsWith('.')) need(key, relative(repo, file));
  }
}

// 3) коди помилок API та ключі validation.* зі спільної бібліотеки
const sharedSrc = join(repo, 'libs', 'shared', 'src');
const apiErrors = readFileSync(join(sharedSrc, 'api-errors.ts'), 'utf8');
const codesBlock = apiErrors.match(/API_ERROR_CODES = \[([\s\S]*?)\] as const/)?.[1] ?? '';
for (const [, code] of codesBlock.matchAll(/'([A-Z_]+)'/g)) need(`errors.${code}`, 'API_ERROR_CODES');
for (const file of walk(sharedSrc)) {
  for (const [, key] of readFileSync(file, 'utf8').matchAll(/'(validation\.[A-Za-z]+)'/g)) {
    need(key, relative(repo, file));
  }
}

// 4) динамічні ключі
for (const f of ['means', 'used', 'n', 'v', 'adj', 'adv', 'collocations'])
  need(`cards.fields.${f}`, 'CARD_TEXT_FIELDS');
for (const r of ['student', 'teacher']) need(`roles.${r}`, 'ROLES');
for (const s of ['pending', 'accepted', 'rejected']) need(`status.${s}`, 'TEACHER_STATUSES');
for (const l of LANGS) (need(`lang.${l}`, 'APP_LANGS'), need(`lang.${l}Full`, 'APP_LANGS'));

for (const [key, where] of required) {
  for (const lang of LANGS)
    if (!dicts[lang].has(key)) problems.push(`${lang}.json: немає «${key}» (${where})`);
}

const unused = [...dicts[base].keys()].filter((key) => !required.has(key));
if (unused.length)
  console.warn(`⚠ i18n: не використовуються в коді (${unused.length}): ${unused.join(', ')}`);

if (problems.length) {
  console.error(`✘ i18n: ${problems.length} проблем(и)\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(
  `✔ i18n: ${dicts[base].size} ключів у ${LANGS.join(', ')}; перевірено ${required.size} використань`,
);
