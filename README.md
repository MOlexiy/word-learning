# WordLoop — вивчення англійських слів з інтервальним рандомом

**🌐 Live: [word-learning-phi.vercel.app](https://word-learning-phi.vercel.app/)**

Monorepo (npm workspaces): **Angular 21** (standalone, signals, zoneless) + **NestJS 11** (модульна Clean Architecture) + **PostgreSQL** (Prisma 7).
Спільні типи, Zod-схеми та алгоритм рандому живуть в одній бібліотеці `@wl/shared`, тож фронт (гостьовий режим) і бек (БД) рахують таймери однаково.

## Можливості

- Картки слів: значення, приклад, форми (n / v / adj / adv), колокації, параграфи-контексти, лічильник відкриттів `k`.
- **Інтервальний рандом:** картка, що випала, блокується на 5·n днів (5, 10 … 30), потім цикл починається знову.
- **Гостьовий режим** без реєстрації: усе зберігається в LocalStorage; після входу картки разом з таймерами переносяться в акаунт.
- Ролі **учень / вчитель:** заявки, прийняття, відкріплення; вчитель переглядає картки учня лише для читання.
- **Озвучка вимови:** 🔊 біля слова, прикладу, форм, колокацій і кожного параграфа; підсвітка слова, що звучить; озвучка будь-якого виділеного фрагмента; акцент US/UK і швидкість 1× / 0.75×.
- **Двомовний інтерфейс** UA / EN.
- Авторизація через HttpOnly-куки з автоматичним оновленням токенів і обмеженням спроб входу.

| Середовище | Адреса                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------- |
| Продакшн   | https://word-learning-phi.vercel.app (фронт на Vercel, `/api` → Render)                       |
| API        | https://wordloop-api.onrender.com/api (перевірка: `/api/health`)                              |
| Локально   | http://localhost:4200 (`npm run dev:web`) або http://localhost:9000 (Docker, `--profile web`) |

> Безкоштовний тариф Render: після 15 хв без запитів API засинає, і перший запит чекає близько хвилини. Гостьовий режим працює завжди.

## Швидкий старт

### Варіант А — бекенд у Docker, фронт локально (рекомендовано для розробки)

```bash
cp apps/api/.env.example apps/api/.env   # Git Bash / Linux / macOS; у cmd: copy apps\api\.env.example apps\api\.env
# у .env задайте власні JWT_ACCESS_SECRET і JWT_REFRESH_SECRET (≥ 32 символи)
docker compose up -d --build     # db + api (http://localhost:3000/api), міграції застосовуються автоматично
npm install
npm run dev:web                  # http://localhost:4200, hot-reload; /api проксіюється на :3000
```

| Сервіс | Що робить                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db`   | PostgreSQL 17, дані у volume `wl-pgdata`, порт 5432                                                                                               |
| `api`  | NestJS; при кожному старті виконує `prisma migrate deploy`, далі сервер. Порт `${API_PORT:-3000}`, healthcheck `GET /api/health` (перевіряє і БД) |
| `web`  | _опційний_ (профіль `web`): nginx з prod-збіркою Angular і проксі `/api` → `api:3000`                                                             |

Фронт змінюється без перезбирання образів; образ `api` перезбирається лише після змін у бекенді: `docker compose up -d --build api`.

`db` та `api` мають `restart: unless-stopped`, тож після першого запуску **самі стартують разом із Docker Desktop**. Для цього Docker Desktop має запускатися з Windows (Settings → General → _Start Docker Desktop when you sign in_).

### Варіант Б — усе в Docker (включно з фронтом)

```bash
docker compose --profile web up -d --build
```

Застосунок буде на `http://localhost:8080`. Якщо порт зайнятий (`port is already allocated`), створіть у корені файл `.env` з рядком `WEB_PORT=9000`: compose читає його автоматично.

Корисне:

```bash
docker compose ps               # стан контейнерів (усі мають бути healthy)
docker compose logs -f api      # логи API
docker compose down             # зупинити (дані БД лишаються)
docker compose --profile web down   # зупинити разом з web
```

### Варіант В — усе локально (бекенд теж з hot-reload)

Потрібні Node.js ≥ 20.19 (рекомендовано 22 LTS) і Docker (або власна PostgreSQL).

```bash
cp apps/api/.env.example apps/api/.env
npm install                      # також збирає @wl/shared і генерує Prisma Client
docker compose up -d db          # лише PostgreSQL на localhost:5432 (wl / wl)
npm run db:migrate               # prisma migrate dev — застосує prisma/migrations
npm run dev:api                  # http://localhost:3000/api
npm run dev:web                  # http://localhost:4200 (proxy /api → :3000)
```

Контейнер `api` і `npm run dev:api` займають той самий порт 3000, тож одночасно запускайте щось одне: `docker compose stop api`, або змініть порт контейнера через `API_PORT=3001` у кореневому `.env`.

Перевірки:

```bash
npm test             # unit-тести рандому/схем + повнота перекладів (i18n:check)
npm run test:smoke   # 19 наскрізних перевірок API (потрібен запущений API; API_URL=… для іншої адреси)
npm run lint         # ESLint 10 flat config (typescript-eslint + angular-eslint)
npm run build        # shared → api → web
```

Додаткові перевірки smoke-тесту вмикаються змінними: `SMOKE_SLOW=1` (повторне використання refresh-токена через 10 с), `SMOKE_THROTTLE=1` (ліміт спроб входу; вичерпує його на хвилину).

## 1. Структура проєкту

```
word-learning/
├─ libs/shared/                      @wl/shared — спільне для front і back
│  └─ src/
│     ├─ spaced-repetition.ts        алгоритм 5·n днів (чисті функції)
│     ├─ api-errors.ts               коди помилок API (перекладаються на фронті)
│     └─ schemas/                    Zod-схеми + DTO-типи (auth, card, mentorship)
├─ apps/api/                         NestJS
│  ├─ prisma/schema.prisma           модель даних
│  ├─ prisma/migrations/             SQL-міграції (DDL)
│  ├─ test/smoke.mjs                 e2e smoke-тест API
│  └─ src/
│     ├─ config/                     валідація .env через Zod
│     ├─ infrastructure/prisma/      PrismaService (driver adapter pg)
│     ├─ infrastructure/health/      GET /api/health (для Docker healthcheck)
│     ├─ common/                     guards/decorators, Clock, ApiException, Zod-pipe, rate limit
│     └─ modules/
│        ├─ auth/                    JWT у куках, ротація refresh-токенів
│        ├─ users/                   профіль, зв'язок учень ↔ вчитель
│        └─ cards/                   CRUD, лічильник k, рандом, імпорт гостьових даних
│           ├─ domain/               порти (abstract class CardsRepository) і типи
│           ├─ application/          use-cases: CardsService, RandomCardService
│           ├─ infrastructure/       адаптер PrismaCardsRepository
│           └─ presentation/         контролери + DTO (createZodDto)
├─ apps/web/                         Angular
│  ├─ public/i18n/ua.json, en.json   переклади
│  ├─ scripts/check-i18n.mjs         перевірка повноти перекладів
│  └─ src/app/
│     ├─ core/
│     │  ├─ i18n/                    Transloco: LanguageService, loader, перемикач, TitleStrategy, ErrorTranslator
│     │  ├─ auth/                    AuthService, TokenRefreshService, інтерцептор, guards
│     │  ├─ browser/                 безпечна обгортка LocalStorage
│     │  └─ notify/                  тости
│     ├─ features/
│     │  ├─ cards/data/              CardsRepository → Local / Api + CardStorageService
│     │  ├─ cards/ui/                card-form, card-view, card-grid
│     │  ├─ cards/pages/             список, створення, детальна
│     │  ├─ auth/                    login, register
│     │  ├─ profile/                 кабінет, панелі учня/вчителя, імпорт гостьових карток
│     │  └─ students/                картки учня для вчителя (read-only)
│     └─ layout/header.component.ts
├─ Dockerfile                        цілі `web` і `api` (multi-stage; `api` — за замовчуванням)
├─ docker/nginx.conf                 SPA + reverse proxy /api
├─ docker-compose.yml                db → api (+ web з профілем `web`)
├─ render.yaml                       Render Blueprint для API
└─ vercel.json                       збірка фронту + проксі /api на Render
```

Залежності модулів API йдуть в один бік: `presentation → application → domain ← infrastructure`. Application-шар працює з портами (`CardsRepository`, `UsersRepository`, `RefreshTokenRepository`, `Clock`), Prisma — лише в infrastructure.

## 2. Схема БД

Повний DDL — [`apps/api/prisma/migrations/20260926000000_init/migration.sql`](apps/api/prisma/migrations/20260926000000_init/migration.sql).

| Таблиця                | Ключові поля                                                                                                     | Примітки                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `users`                | `username` PK, `email` UNIQUE, `password_hash`, `role` (enum), `teacher_id` FK→users, `teacher_status` (enum)    | CHECK: `teacher_id` і `teacher_status` або обидва NULL, або обидва задані |
| `word_cards`           | `id` UUID PK, `user_id` FK, `name`, `means`, `used`, `n`, `v`, `adj`, `adv`, `collocations`, `topic TEXT[]`, `k` | індекс `(user_id, name)`                                                  |
| `card_random_progress` | `card_id` PK/FK, `repetition_step` SMALLINT, `locked_until` TIMESTAMPTZ                                          | CHECK 1..6; відсутній рядок = картка ще не випадала                       |
| `refresh_tokens`       | `id` (= `jti`), `user_id`, `expires_at`, `revoked_at`, `replaced_by_id`                                          | ротація + виявлення повторного використання                               |

`userId` у картки в БД NOT NULL: гостьові картки в БД не потрапляють — вони в LocalStorage з `userId: null`.

## 3. Ключові рішення

### Інтервальний рандом (5·n днів)

Один алгоритм на обидва режими — `libs/shared/src/spaced-repetition.ts`:

```ts
advanceProgress(progress, now); // n=1 → +5д, n=2 → +10д … n=6 → +30д; n: 6 → 1
isCardAvailable(progress, now); // немає прогресу або lockedUntil <= now
```

- **Гість:** `LocalCardsRepository.drawRandom()` фільтрує ідентифікатори через `pickRandomAvailableId`, зберігає `{ [cardId]: { n, lockedUntil } }` у ключ `wl.guest.randomProgress`.
- **Сервер:** `RandomCardService` → `PrismaCardsRepository.drawRandom()` робить в одній транзакції
  `SELECT … LEFT JOIN card_random_progress … WHERE p.card_id IS NULL OR p.locked_until <= now ORDER BY random() LIMIT 1 FOR UPDATE OF c SKIP LOCKED`
  і upsert прогресу. Правило переходу передається з application-шару тією самою `advanceProgress`.
- Якщо все заблоковано, API повертає `{ cardId: null, nextAvailableAt }`, і UI показує, коли з'явиться наступна картка.

### StorageService (LocalStorage ↔ API)

`CardStorageService` реалізує той самий інтерфейс `CardsRepository`, що й обидві стратегії, і перемикається через `computed()` від `AuthService.isAuthenticated()`. Компоненти не знають, де лежать дані; сторінки підписуються на `storage.mode()` і перезавантажують дані при логіні/логауті. Биті записи в LocalStorage відкидаються поштучно через Zod.

Після входу в кабінеті з'являється блок **«Гостьові дані в цьому браузері»**: `POST /api/cards/import` переносить картки разом з таймерами (id генеруються заново, прогрес перепідв'язується).

### Auth

- Access JWT (1 день) — кука `auth`, `Path=/`. Refresh JWT (30 днів, з `jti`) — кука `refresh`, `Path=/api/auth`, тож браузер не надсилає її в кожному запиті. Обидві `HttpOnly; Secure; SameSite=Strict`.
- Кожен `/api/auth/refresh` **ротує** токен. Якщо ротований токен використали вдруге пізніше ніж через 10 с, це вважається крадіжкою, і всі сесії користувача відкликаються. Паралельний refresh з двох вкладок (≤ 10 с) дозволено. Токен після logout не приймається взагалі.
- `authRefreshInterceptor` (функціональний): 401 → один спільний refresh на всі паралельні запити (`TokenRefreshService` + `shareReplay`) → повтор початкового запиту. Якщо refresh не вдався, застосунок переходить у гостьовий режим; якщо сесія була активна — редирект на `/login?returnUrl=…`.
- Статус сесії визначається в `provideAppInitializer` через `/api/auth/me` ще до першої навігації.

### Двомовність (UA / EN)

Бібліотека — [Transloco](https://jsverse.gitbook.io/transloco) (`@jsverse/transloco`), переклади лежать у `apps/web/public/i18n/ua.json` та `en.json` і вантажаться за потреби.

- **Вибір мови:** перемикач `UA | EN` у хедері. Вибір зберігається в LocalStorage (`wl.lang`); без нього береться мова браузера (`uk*` → UA, `en*` → EN, інакше UA).
- `LanguageService` до першого рендеру завантажує словник (без «миготіння» ключів), ставить `<html lang="uk|en">`, локаль для `Intl` (дати в тостах) і локаль Zod.
- **Шаблони:** `{{ 'cards.list.title' | transloco }}`, з параметрами — `{{ 'cards.view.topics' | transloco: { count: n } }}`; у TS — `TranslocoService.translate()`.
- **Заголовки вкладок:** `title` у маршрутах — це i18n-ключ; `TranslatedTitleStrategy` перекладає його й оновлює при зміні мови.
- **Помилки API:** бекенд повертає `{ statusCode, code, message }` (коди в `@wl/shared/api-errors.ts`, `message` англійською для логів); `ErrorTranslator` показує `errors.<code>`. Якщо API недоступне, пише «Сервер недоступний».
- **Валідація:** власні повідомлення в Zod-схемах — це ключі `validation.*`, стандартні (min/max…) Zod локалізує сам (`z.config(uk()/en())`). Помилки, вже показані на сторінці, перекладаються при перемиканні мови: `computed()` залежить від сигналу мови.
- **Додати мову:** новий `<lang>.json` + код в `APP_LANGS` (`core/i18n/i18n.config.ts`) і в `LANGS` скрипта перевірки.
- `npm run i18n:check -w @wl/web` (входить у `npm test`) падає, якщо в одному з файлів бракує ключа чи значення порожнє, якщо ключа з коду, коду помилки API або `validation.*` немає у словнику; невикористані ключі показує як попередження.

### Озвучка (Web Speech API)

Вбудований у браузер `speechSynthesis`: без сторонніх сервісів, ключів і лімітів на довжину тексту. Код — `apps/web/src/app/core/speech/`.

- `SpeechService` обирає англійський голос потрібного акценту, віддаючи перевагу «природним» (Natural / Neural / Online / Google), і зберігає акцент і швидкість у LocalStorage (`wl.speech.accent`, `wl.speech.rate`).
- Довгий текст ділиться на речення (`Intl.Segmenter`), а надто довгі речення — на шматки ≤ 220 символів, які звучать один за одним: Chrome інакше обриває озвучку мережевих голосів приблизно через 15 с.
- `wl-speak-button` — кнопка 🔊 / ⏹; `wl-spoken-text` підсвічує слово, що звучить (події `boundary`; мережеві голоси Google у Chrome їх не надсилають — тоді озвучка без підсвітки).
- `wl-selection-speaker` — плаваюча кнопка «Озвучити виділене» над виділеним фрагментом у картці (подвійний клік по слову теж працює); на сенсорних екранах — під виділенням, щоб не перекривати системне меню.
- Переклад (`means`) не озвучується; перехід на іншу сторінку зупиняє озвучку; якщо в браузері немає англійських голосів, кнопки не показуються.
- Якість голосу залежить від браузера й ОС: найкращі — Edge (Microsoft Natural) і Chrome (Google). Для однакових студійних голосів у майбутньому можна додати бекенд-ендпоінт з Google Cloud TTS / Azure і кешем аудіо — компоненти UI не зміняться.

### Вчитель ↔ учень

```
student PUT /profile/teacher        → pending   (можна повторно: той самий чи інший вчитель)
teacher POST requests/:u/accept     pending  → accepted
teacher POST requests/:u/reject     pending  → rejected
teacher DELETE students/:u          accepted → rejected («Відкріпити»; учень бачить статус і може надіслати запит знову)
```

Переходи атомарні (`updateMany` з умовою на поточний статус). Вчитель бачить картки лише учнів зі статусом `accepted`.

## 4. API

| Метод          | Шлях                                                     | Опис                              |
| -------------- | -------------------------------------------------------- | --------------------------------- |
| POST           | `/api/auth/register` · `/login` · `/refresh` · `/logout` | публічні                          |
| GET            | `/api/auth/me`                                           | профіль                           |
| GET/POST       | `/api/cards`                                             | список (`id`, `name`) / створення |
| POST           | `/api/cards/random`                                      | рандом з таймером                 |
| POST           | `/api/cards/import`                                      | імпорт гостьових карток           |
| GET/PUT/DELETE | `/api/cards/:id`                                         | картка (GET без побічних ефектів) |
| POST           | `/api/cards/:id/view`                                    | відкриття картки, `k + 1`         |
| POST           | `/api/cards/:id/topics`                                  | додати параграф                   |
| GET            | `/api/teachers?query=`                                   | пошук вчителів                    |
| PUT/DELETE     | `/api/profile/teacher`                                   | заявка / відкріплення (student)   |
| GET            | `/api/teacher/requests` · `/students`                    | teacher                           |
| POST           | `/api/teacher/requests/:u/accept` · `/reject`            | teacher                           |
| DELETE         | `/api/teacher/students/:u`                               | teacher                           |
| GET            | `/api/teacher/students/:u/cards[/:id]`                   | read-only картки учня             |
| GET            | `/api/health`                                            | стан API і БД (публічний)         |

## 5. Що варто знати

- **Angular 21, не 22.** Angular 22 вимагає Node ≥ 22.22.3; 21 працює на Node 20.19+/22.12+. Оновлення: `ng update @angular/core@22 @angular/cli@22`.
- **Міграцію написано вручну** в тому форматі, який генерує Prisma (у середовищі розробки був недоступний бінарник schema-engine). Її застосовано й перевірено на PostgreSQL 17. Якщо `prisma migrate dev` запропонує невеликий diff, це косметика.
- **`k` не редагується** через форму: це службовий лічильник. Вчитель, відкриваючи картку учня, `k` не збільшує.
- **«Рандомне слово учня»** обирається на фронті з уже завантаженого списку і нічого не записує.
- Прострочені refresh-токени чистяться при старті API; при зростанні навантаження варто винести це в cron.
- Rate limit (`@nestjs/throttler`) зберігає лічильники в пам'яті — для кількох інстансів API потрібне спільне сховище (Redis).
- Без dev-proxy (фронт на іншому origin) задайте `WEB_ORIGIN`. Але з `SameSite=Strict` фронт і API мають бути на одному сайті.
- **Docker і `COOKIE_SECURE=true`:** браузери приймають Secure-куки на `http://localhost`, але не на `http://<IP-адреса>`. Якщо відкриваєте застосунок з іншого пристрою в мережі без HTTPS, поставте `COOKIE_SECURE=false` у `.env` (лише для локальної мережі) або налаштуйте HTTPS.
- Образ `api` містить усі `node_modules` монорепо (разом із dev-залежностями), тому важить кілька сотень МБ. Для проду варто зробити окремий `npm ci --omit=dev` лише для API.

## 6. Деплой: Vercel (фронт) + Render (API) + Neon (PostgreSQL)

Поточний продакшн: **https://word-learning-phi.vercel.app** → API `https://wordloop-api.onrender.com` → Neon (Frankfurt).

```
Браузер → https://word-learning-phi.vercel.app
            ├─ статика Angular (Vercel CDN)
            └─ /api/*  →  rewrite (проксі) → https://wordloop-api.onrender.com/api/*  →  Neon Postgres
```

Для браузера фронт і API на одному домені (`*.vercel.app`), тож HttpOnly-куки з `SameSite=Strict` працюють без CORS і без змін у коді. Конфіги лежать у репозиторії: `vercel.json`, `render.yaml`, `Dockerfile` (стадія `api` — ціль за замовчуванням).

### Крок 1. Neon — база

1. **New Project** → Postgres 17, регіон **AWS Europe Central 1 (Frankfurt)** (поруч із Render).
2. **Connect** → вимкніть **Connection pooling** (для міграцій Prisma потрібне пряме підключення) → скопіюйте рядок `postgresql://…neon.tech/neondb?sslmode=require&channel_binding=require`.

### Крок 2. Render — API

1. **New → Blueprint** → підключіть GitHub-репозиторій → Render прочитає `render.yaml`.
2. У полі `DATABASE_URL` вставте рядок з Neon → **Apply**. JWT-секрети Render згенерує сам.
3. Перший деплой триває кілька хвилин (збірка Docker-образу, потім `prisma migrate deploy` створить таблиці).
4. Перевірка: `https://wordloop-api.onrender.com/api/health` → `{"status":"ok"}`.

> Якщо ім'я `wordloop-api` зайняте, Render дасть адресу з суфіксом (видно вгорі сторінки сервісу). Тоді замініть адресу в `vercel.json` (`rewrites[0].destination`) і зробіть push.

### Крок 3. Vercel — фронт

1. **Add New → Project** → імпортуйте той самий репозиторій.
2. **Root Directory** — корінь репозиторію (`./`). Vercel може сам запропонувати `apps/api` з пресетом NestJS — змініть на корінь.
3. **Application Preset** — Other (у `vercel.json` стоїть `"framework": null`, він має пріоритет). **Build and Output Settings** не чіпайте — беруться з `vercel.json`.
4. **Environment Variables** не потрібні: якщо Vercel «знайшов» змінні з `apps/api/.env.example`, видаліть їх.
5. **Deploy** → сайт буде на `https://<проєкт>.vercel.app` (у нас — https://word-learning-phi.vercel.app).

### Як це працює далі

- Кожен `git push` у `main` оновлює і фронт, і API. Render перезбирає API лише при змінах бекенду (`buildFilter`); Vercel збирає фронт на кожен push.
- **Free-тариф Render:** API засинає після 15 хв без запитів і прокидається близько хвилини. Перший запит після паузи може отримати «Сервер недоступний»; повторна спроба за хвилину пройде. Гостьовий режим працює завжди.
- **Neon free:** 0.5 GB, база засинає після 5 хв простою і прокидається за частки секунди.
- Вхід і реєстрація обмежені 10 спробами на хвилину з одного IP (`@nestjs/throttler`, відповідь 429 → «Забагато спроб»).
- Змінні оточення API на Render: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `NODE_ENV=production`.
