// Наскрізний smoke-тест API проти запущеного сервера та БД.
//   npm run dev:api            (в іншому терміналі)
//   npm run test:smoke         (з кореня)
// Змінна API_URL перевизначає адресу (за замовчуванням http://localhost:3000/api).
import assert from 'node:assert/strict';

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const suffix = Math.random().toString(36).slice(2, 8);
const DAY = 24 * 60 * 60 * 1000;

/** Мінімальний «браузер»: зберігає куки між запитами. */
function createClient() {
  const jar = new Map();
  async function call(method, path, body) {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(API + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const raw of res.headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(';');
      const [name, value] = pair.split('=');
      const expired = attrs.some((a) => /expires=thu, 01 jan 1970/i.test(a.trim()));
      if (!value || expired) jar.delete(name);
      else jar.set(name, value);
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, raw: res };
  }
  return { call, jar };
}

let step = 0;
async function check(name, fn) {
  step++;
  await fn();
  console.log(`  ✔ ${step}. ${name}`);
}

const teacher = createClient();
const student = createClient();
const T = `teacher_${suffix}`;
const S = `student_${suffix}`;
const cardIds = [];

console.log(`Smoke test → ${API}`);

await check('health: API і БД доступні', async () => {
  const res = await createClient().call('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

await check('гість без куки отримує 401', async () => {
  const res = await createClient().call('GET', '/cards');
  assert.equal(res.status, 401);
});

await check('реєстрація teacher і student ставить HttpOnly+SameSite=Strict куки', async () => {
  const t = await teacher.call('POST', '/auth/register', {
    username: T,
    email: `${T}@ex.com`,
    password: 'password123',
    role: 'teacher',
  });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  const cookies = t.raw.headers.getSetCookie().join('\n');
  assert.match(cookies, /auth=.*HttpOnly.*SameSite=Strict/i);
  assert.match(cookies, /refresh=.*Path=\/api\/auth/i);
  const s = await student.call('POST', '/auth/register', {
    username: S,
    email: `${S}@ex.com`,
    password: 'password123',
    role: 'student',
  });
  assert.equal(s.status, 201);
  assert.deepEqual(s.body, { username: S, email: `${S}@ex.com`, role: 'student', teacher: null });
});

await check('дублікат username (без урахування регістру) → 409', async () => {
  const res = await createClient().call('POST', '/auth/register', {
    username: S.toUpperCase(),
    email: `x${suffix}@ex.com`,
    password: 'password123',
    role: 'student',
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'USERNAME_TAKEN');
});

await check('невірний пароль → 401 INVALID_CREDENTIALS', async () => {
  const res = await createClient().call('POST', '/auth/login', { login: S, password: 'wrong-password' });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'INVALID_CREDENTIALS');
});

await check('невалідне тіло → 400 від Zod', async () => {
  const res = await student.call('POST', '/cards', { name: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'VALIDATION_FAILED');
  assert.deepEqual(res.body.errors[0], { path: 'name', message: 'validation.nameRequired' });
});

await check('CRUD картки + дефолти', async () => {
  for (const name of ['apple', 'banana', 'cherry']) {
    const res = await student.call('POST', '/cards', {
      name,
      means: `${name} means`,
      topic: [`I like ${name}.`],
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.k, 0);
    assert.equal(res.body.adv, '');
    cardIds.push(res.body.id);
  }
  const list = await student.call('GET', '/cards');
  assert.deepEqual(
    list.body.map((c) => c.name),
    ['apple', 'banana', 'cherry'],
  );
  assert.deepEqual(Object.keys(list.body[0]).sort(), ['id', 'name']);
});

await check('view збільшує k, GET — ні', async () => {
  await student.call('POST', `/cards/${cardIds[0]}/view`);
  const viewed = await student.call('POST', `/cards/${cardIds[0]}/view`);
  assert.equal(viewed.body.k, 2);
  const got = await student.call('GET', `/cards/${cardIds[0]}`);
  assert.equal(got.body.k, 2);
});

await check('додавання параграфа та редагування', async () => {
  const added = await student.call('POST', `/cards/${cardIds[0]}/topics`, { text: 'An apple a day.' });
  assert.deepEqual(added.body.topic, ['I like apple.', 'An apple a day.']);
  const updated = await student.call('PUT', `/cards/${cardIds[0]}`, {
    ...added.body,
    name: 'apple!',
    v: 'to apple',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.name, 'apple!');
  assert.equal(updated.body.k, 2, 'k не редагується через PUT');
  assert.equal(updated.body.id, cardIds[0]);
});

await check('видалення параграфа: лише якщо текст збігається (інакше 409 TOPIC_CHANGED)', async () => {
  const stale = await student.call('DELETE', `/cards/${cardIds[0]}/topics/1`, { text: 'something else' });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'TOPIC_CHANGED');
  const outOfRange = await student.call('DELETE', `/cards/${cardIds[0]}/topics/9`, {
    text: 'An apple a day.',
  });
  assert.equal(outOfRange.body.code, 'TOPIC_CHANGED');
  const ok = await student.call('DELETE', `/cards/${cardIds[0]}/topics/1`, { text: 'An apple a day.' });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.topic, ['I like apple.']);
  const foreign = await teacher.call('DELETE', `/cards/${cardIds[0]}/topics/0`, { text: 'I like apple.' });
  assert.equal(foreign.body.code, 'CARD_NOT_FOUND');
});

await check('рандом: 3 різні картки, потім null + nextAvailableAt ≈ now + 5 днів', async () => {
  const drawn = [];
  for (let i = 0; i < 3; i++) {
    const res = await student.call('POST', '/cards/random');
    assert.equal(res.status, 200);
    drawn.push(res.body.cardId);
  }
  assert.deepEqual([...drawn].sort(), [...cardIds].sort());
  const empty = await student.call('POST', '/cards/random');
  assert.equal(empty.body.cardId, null);
  const diff = Date.parse(empty.body.nextAvailableAt) - Date.now();
  assert.ok(Math.abs(diff - 5 * DAY) < 60_000, `очікували ~5 днів, отримали ${diff / DAY}`);
});

await check('чужа картка → 404, невалідний uuid → 400', async () => {
  const foreign = await teacher.call('GET', `/cards/${cardIds[1]}`);
  assert.equal(foreign.status, 404);
  assert.equal(foreign.body.code, 'CARD_NOT_FOUND');
  assert.equal((await student.call('GET', '/cards/not-a-uuid')).status, 400);
});

await check('refresh ротує токени, /me працює з новим access', async () => {
  const oldRefresh = student.jar.get('refresh');
  const res = await student.call('POST', '/auth/refresh');
  assert.equal(res.status, 200);
  assert.notEqual(student.jar.get('refresh'), oldRefresh);
  assert.equal((await student.call('GET', '/auth/me')).body.username, S);
});

await check('паралельний refresh з двох вкладок не розлогінює', async () => {
  const token = student.jar.get('refresh');
  const tabs = [createClient(), createClient()];
  tabs.forEach((tab) => tab.jar.set('refresh', token));
  const results = await Promise.all(tabs.map((tab) => tab.call('POST', '/auth/refresh')));
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  student.jar.set('refresh', tabs[0].jar.get('refresh'));
  student.jar.set('auth', tabs[0].jar.get('auth'));
});

await check('student не має доступу до teacher-ендпоінтів (403)', async () => {
  const res = await student.call('GET', '/teacher/requests');
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'FORBIDDEN_ROLE');
});

await check('заявка → pending, вчитель бачить її та приймає', async () => {
  const search = await student.call('GET', `/teachers?query=${T.slice(0, 10)}`);
  assert.ok(search.body.some((t) => t.username === T));
  const req = await student.call('PUT', '/profile/teacher', { teacherUsername: T });
  assert.deepEqual(req.body.teacher, { username: T, status: 'pending' });
  assert.equal(
    (await teacher.call('GET', `/teacher/students/${S}/cards`)).status,
    404,
    'до прийняття доступу немає',
  );
  const requests = await teacher.call('GET', '/teacher/requests');
  assert.deepEqual(
    requests.body.map((r) => r.username),
    [S],
  );
  assert.equal((await teacher.call('POST', `/teacher/requests/${S}/accept`)).status, 204);
  assert.equal((await student.call('GET', '/auth/me')).body.teacher.status, 'accepted');
});

await check('вчитель переглядає картки учня read-only (k учня не змінюється)', async () => {
  const list = await teacher.call('GET', `/teacher/students/${S}/cards`);
  assert.equal(list.body.length, 3);
  const card = await teacher.call('GET', `/teacher/students/${S}/cards/${cardIds[0]}`);
  assert.equal(card.body.k, 2);
  assert.equal((await student.call('GET', `/cards/${cardIds[0]}`)).body.k, 2);
});

await check('пошук: один запит шукає по name, n, v, adj, adv; у відповіді лише id і name', async () => {
  const byName = await student.call('GET', '/cards?q=APP');
  assert.deepEqual(byName.body, [{ id: cardIds[0], name: 'apple!' }]);
  const byVerb = await student.call('GET', '/cards?q=to%20apple');
  assert.deepEqual(byVerb.body, [{ id: cardIds[0], name: 'apple!' }], 'знайдено за полем v');
  assert.deepEqual(
    (await student.call('GET', '/cards?q=an')).body.map((c) => c.name),
    ['banana'],
  );
  assert.deepEqual((await student.call('GET', '/cards?q=%25')).body, [], '% не є шаблоном');
  const forTeacher = await teacher.call('GET', `/teacher/students/${S}/cards?q=cher`);
  assert.deepEqual(
    forTeacher.body.map((c) => c.name),
    ['cherry'],
  );
});

await check('дублікати: та сама назва → 409 CARD_EXISTS, слово у формах → related', async () => {
  const exact = await student.call('GET', '/cards/duplicates?name=%20Banana%20');
  assert.deepEqual(exact.body, { exact: { id: cardIds[1], name: 'banana' }, related: [] });
  const related = await student.call('GET', '/cards/duplicates?name=apple');
  assert.deepEqual(related.body, {
    exact: null,
    related: [{ id: cardIds[0], name: 'apple!', fields: ['v'] }],
  });
  const create = await student.call('POST', '/cards', { name: 'BANANA' });
  assert.equal(create.status, 409);
  assert.equal(create.body.code, 'CARD_EXISTS');
  assert.equal(create.body.meta.cardId, cardIds[1]);
  assert.equal((await student.call('GET', '/cards')).body.length, 3);
});

await check('чернетка: швидке/масове додавання, пропуск повторів і наявних карток', async () => {
  const res = await student.call('POST', '/drafts', {
    items: [
      { word: 'serendipity', meaning: 'щаслива випадковість' },
      { word: 'Cherry' },
      { word: 'SERENDIPITY' },
    ],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(
    res.body.created.map((d) => [d.word, d.meaning, d.addedBy]),
    [['serendipity', 'щаслива випадковість', null]],
  );
  assert.deepEqual(res.body.skipped, [
    { word: 'Cherry', reason: 'card', cardId: cardIds[2] },
    { word: 'SERENDIPITY', reason: 'draft' },
  ]);
  const empty = await student.call('POST', '/drafts', { items: [{ word: '   ' }] });
  assert.equal(empty.status, 400);
});

await check('вчитель бачить чернетку учня і додає йому «швидке слово»', async () => {
  const added = await teacher.call('POST', `/teacher/students/${S}/drafts`, {
    items: [{ word: 'ubiquitous' }],
  });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.equal(added.body.created[0].addedBy, T);
  const mine = await student.call('GET', '/drafts');
  assert.deepEqual(
    mine.body.map((d) => d.word),
    ['ubiquitous', 'serendipity'],
    'нові зверху',
  );
  const seen = await teacher.call('GET', `/teacher/students/${S}/drafts`);
  assert.equal(seen.body.length, 2);
  const own = mine.body.find((d) => d.word === 'serendipity');
  const denied = await teacher.call('DELETE', `/teacher/students/${S}/drafts/${own.id}`);
  assert.equal(denied.status, 403, 'чуже слово учня вчитель не видаляє');
  assert.equal((await student.call('GET', '/drafts/whatever')).status, 404);
});

await check('картка з чернетки: чернетка зникає; видалення чернетки', async () => {
  const drafts = (await student.call('GET', '/drafts')).body;
  const serendipity = drafts.find((d) => d.word === 'serendipity');
  const ubiquitous = drafts.find((d) => d.word === 'ubiquitous');
  const card = await student.call('POST', `/cards?fromDraft=${serendipity.id}`, {
    name: serendipity.word,
    means: serendipity.meaning,
  });
  assert.equal(card.status, 201, JSON.stringify(card.body));
  assert.deepEqual(
    (await student.call('GET', '/drafts')).body.map((d) => d.id),
    [ubiquitous.id],
  );
  const foreign = await teacher.call('DELETE', `/drafts/${ubiquitous.id}`);
  assert.equal(foreign.body.code, 'DRAFT_NOT_FOUND');
  assert.equal((await student.call('DELETE', `/drafts/${ubiquitous.id}`)).status, 204);
  assert.deepEqual((await student.call('GET', '/drafts')).body, []);
  // Прибираємо, щоб не заважати наступним перевіркам рандому.
  assert.equal((await student.call('DELETE', `/cards/${card.body.id}`)).status, 204);
});

await check('відкріплення → rejected, доступ зникає, учень може подати знову', async () => {
  assert.equal((await teacher.call('DELETE', `/teacher/students/${S}`)).status, 204);
  assert.equal((await student.call('GET', '/auth/me')).body.teacher.status, 'rejected');
  assert.equal((await teacher.call('GET', `/teacher/students/${S}/cards`)).status, 404);
  const again = await student.call('PUT', '/profile/teacher', { teacherUsername: T });
  assert.equal(again.body.teacher.status, 'pending');
  assert.equal((await teacher.call('POST', `/teacher/requests/${S}/reject`)).status, 204);
  assert.equal((await student.call('GET', '/auth/me')).body.teacher.status, 'rejected');
});

await check('імпорт гостьових карток з прогресом', async () => {
  const lockedUntil = new Date(Date.now() + 3 * DAY).toISOString();
  const res = await student.call('POST', '/cards/import', {
    cards: [
      { id: 'local-1', name: 'guest-word', k: 4, topic: [] },
      { id: 'local-2', name: 'guest-locked', topic: ['x'] },
    ],
    progress: { 'local-2': { n: 3, lockedUntil } },
    drafts: [{ word: 'guest-draft', meaning: 'x' }],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.imported, 2);
  assert.equal(res.body.importedDrafts, 1);
  assert.deepEqual(
    (await student.call('GET', '/drafts')).body.map((d) => d.word),
    ['guest-draft'],
  );
  const random = await student.call('POST', '/cards/random');
  const card = await student.call('GET', `/cards/${random.body.cardId}`);
  assert.equal(card.body.name, 'guest-word', 'доступна лише не заблокована імпортована картка');
});

await check('logout відкликає refresh', async () => {
  const stolenRefresh = student.jar.get('refresh');
  assert.equal((await student.call('POST', '/auth/logout')).status, 204);
  assert.equal(student.jar.has('auth'), false);
  const attacker = createClient();
  attacker.jar.set('refresh', stolenRefresh);
  assert.equal((await attacker.call('POST', '/auth/refresh')).status, 401);
});

if (process.env.SMOKE_SLOW) {
  await check('повторне використання ротованого refresh через >10с відкликає всі сесії', async () => {
    const victim = createClient();
    await victim.call('POST', '/auth/login', { login: T, password: 'password123' });
    const stolen = victim.jar.get('refresh');
    assert.equal((await victim.call('POST', '/auth/refresh')).status, 200);
    await new Promise((r) => setTimeout(r, 11_000));
    const attacker = createClient();
    attacker.jar.set('refresh', stolen);
    assert.equal((await attacker.call('POST', '/auth/refresh')).status, 401);
    assert.equal((await victim.call('POST', '/auth/refresh')).status, 401, 'сесію жертви теж відкликано');
  });
}

// Вичерпує ліміт входу для цього IP на хвилину, тому вмикається окремо.
if (process.env.SMOKE_THROTTLE) {
  await check('rate limit: 11-й вхід за хвилину → 429 TOO_MANY_REQUESTS', async () => {
    let last;
    for (let i = 0; i < 11; i++) {
      last = await createClient().call('POST', '/auth/login', {
        login: 'nobody',
        password: 'wrong-password',
      });
    }
    assert.equal(last.status, 429);
    assert.equal(last.body.code, 'TOO_MANY_REQUESTS');
  });
}

console.log(`\nУсі ${step} перевірок пройдено.`);
