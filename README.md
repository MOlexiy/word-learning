# WordLoop — learning English words with spaced random review

**🌐 Live: [word-learning-phi.vercel.app](https://word-learning-phi.vercel.app/)**

Monorepo (npm workspaces): **Angular 21** (standalone, signals, zoneless) + **NestJS 11** (modular Clean Architecture) + **PostgreSQL** (Prisma 7).
Shared types, Zod schemas and the random-draw algorithm live in a single library, `@wl/shared`, so the frontend (guest mode) and the backend (DB) compute timers the same way.

## Features

- Word cards: meaning, usage example, forms (n / v / adj / adv), collocations, context paragraphs, and an open counter `k`.
- **Inbox (Чернетка):** the header `+` quick-saves a word with an optional short meaning (or a whole list — comma/newline separated, `word - meaning` lines keep the meaning). Later, "Fill in →" opens the full card form pre-filled; once the card is created the word leaves the inbox and a toast offers the next one.
- **Search via API** with a 300 ms debounce: one query is matched against `name`, `n`, `v`, `adj` and `adv`; the list still shows only the word. The query lives in the URL (`/?q=run&view=inbox`).
- **Duplicate check on create:** the same word as an existing card's name blocks creation (with a link to that card); a match only in another card's `n` / `v` / `adj` / `adv` asks "Is it the same card?" with links that open in a new tab.
- **Spaced random draw:** a card that has been drawn is locked for 5·n days (5, 10 … 30), after which the cycle starts over.
- **Guest mode** with no sign-up: everything is stored in LocalStorage; after signing in, cards are transferred to the account together with their timers.
- **Student / teacher** roles: requests, acceptance, unlinking; a teacher views a student's cards and inbox read-only, and can add a "quick word" to the student's inbox. A student can share a link to a card or an inbox word with their teacher.
- **Pronunciation (text-to-speech):** 🔊 next to the word, usage example, forms, collocations and every paragraph; highlighting of the word being spoken; speaking any selected fragment; US/UK accent and 1× / 0.75× speed.
- **Bilingual interface**, UA / EN.
- Authentication via HttpOnly cookies with automatic token refresh and login attempt limiting.

| Environment | URL                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------- |
| Production  | https://word-learning-phi.vercel.app (frontend on Vercel, `/api` → Render)                   |
| API         | https://wordloop-api.onrender.com/api (health check: `/api/health`)                          |
| Local       | http://localhost:4200 (`npm run dev:web`) or http://localhost:9000 (Docker, `--profile web`) |

> Render free tier: after 15 minutes without requests the API goes to sleep, and the first request waits about a minute. Guest mode always works.

## Quick start

### Option A — backend in Docker, frontend locally (recommended for development)

```bash
cp apps/api/.env.example apps/api/.env   # Git Bash / Linux / macOS; in cmd: copy apps\api\.env.example apps\api\.env
# in .env, set your own JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (≥ 32 characters)
docker compose up -d --build     # db + api (http://localhost:3000/api), migrations are applied automatically
npm install
npm run dev:web                  # http://localhost:4200, hot reload; /api is proxied to :3000
```

| Service | What it does                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db`    | PostgreSQL 17, data in the `wl-pgdata` volume, port 5432                                                                                          |
| `api`   | NestJS; runs `prisma migrate deploy` on every start, then the server. Port `${API_PORT:-3000}`, healthcheck `GET /api/health` (checks the DB too) |
| `web`   | _optional_ (`web` profile): nginx with the Angular prod build and a `/api` → `api:3000` proxy                                                     |

The frontend can change without rebuilding images; the `api` image only needs rebuilding after backend changes: `docker compose up -d --build api`.

`db` and `api` have `restart: unless-stopped`, so after the first run they **start automatically together with Docker Desktop**. For this, Docker Desktop must launch with Windows (Settings → General → _Start Docker Desktop when you sign in_).

### Option B — everything in Docker (including the frontend)

```bash
docker compose --profile web up -d --build
```

The app will be at `http://localhost:8080`. If the port is taken (`port is already allocated`), create a `.env` file in the repository root with the line `WEB_PORT=9000`: compose reads it automatically.

Useful commands:

```bash
docker compose ps               # container status (all should be healthy)
docker compose logs -f api      # API logs
docker compose down             # stop (DB data is kept)
docker compose --profile web down   # stop, including web
```

### Option C — everything locally (backend with hot reload too)

Requires Node.js ≥ 20.19 (22 LTS recommended) and Docker (or your own PostgreSQL).

```bash
cp apps/api/.env.example apps/api/.env
npm install                      # also builds @wl/shared and generates the Prisma Client
docker compose up -d db          # PostgreSQL only, on localhost:5432 (wl / wl)
npm run db:migrate               # prisma migrate dev — applies prisma/migrations
npm run dev:api                  # http://localhost:3000/api
npm run dev:web                  # http://localhost:4200 (proxy /api → :3000)
```

The `api` container and `npm run dev:api` use the same port 3000, so run only one of them at a time: `docker compose stop api`, or change the container port with `API_PORT=3001` in the root `.env`.

Checks:

```bash
npm test             # unit tests for the random draw/schemas + translation completeness (i18n:check)
npm run test:smoke   # 19 end-to-end API checks (requires a running API; API_URL=… for a different address)
npm run lint         # ESLint 10 flat config (typescript-eslint + angular-eslint)
npm run build        # shared → api → web
```

Additional smoke test checks are enabled via variables: `SMOKE_SLOW=1` (reusing a refresh token after 10 s), `SMOKE_THROTTLE=1` (login attempt limit; exhausts it for a minute).

## 1. Project structure

```
word-learning/
├─ libs/shared/                      @wl/shared — shared by front and back
│  └─ src/
│     ├─ spaced-repetition.ts        5·n days algorithm (pure functions)
│     ├─ api-errors.ts               API error codes (translated on the frontend)
│     └─ schemas/                    Zod schemas + DTO types (auth, card, mentorship)
├─ apps/api/                         NestJS
│  ├─ prisma/schema.prisma           data model
│  ├─ prisma/migrations/             SQL migrations (DDL)
│  ├─ test/smoke.mjs                 e2e API smoke test
│  └─ src/
│     ├─ config/                     .env validation with Zod
│     ├─ infrastructure/prisma/      PrismaService (pg driver adapter)
│     ├─ infrastructure/health/      GET /api/health (for the Docker healthcheck)
│     ├─ common/                     guards/decorators, Clock, ApiException, Zod pipe, rate limit
│     └─ modules/
│        ├─ auth/                    JWT in cookies, refresh token rotation
│        ├─ users/                   profile, student ↔ teacher link
│        └─ cards/                   CRUD, k counter, random draw, guest data import
│           ├─ domain/               ports (abstract class CardsRepository) and types
│           ├─ application/          use cases: CardsService, RandomCardService
│           ├─ infrastructure/       PrismaCardsRepository adapter
│           └─ presentation/         controllers + DTOs (createZodDto)
├─ apps/web/                         Angular
│  ├─ public/i18n/ua.json, en.json   translations
│  ├─ scripts/check-i18n.mjs         translation completeness check
│  └─ src/app/
│     ├─ core/
│     │  ├─ i18n/                    Transloco: LanguageService, loader, switcher, TitleStrategy, ErrorTranslator
│     │  ├─ auth/                    AuthService, TokenRefreshService, interceptor, guards
│     │  ├─ browser/                 safe LocalStorage wrapper
│     │  └─ notify/                  toasts
│     ├─ features/
│     │  ├─ cards/data/              CardsRepository → Local / Api + CardStorageService
│     │  ├─ cards/ui/                card-form, card-view, card-grid
│     │  ├─ cards/pages/             list, create, detail
│     │  ├─ auth/                    login, register
│     │  ├─ profile/                 account page, student/teacher panels, guest card import
│     │  └─ students/                student's cards for the teacher (read-only)
│     └─ layout/header.component.ts
├─ Dockerfile                        `web` and `api` targets (multi-stage; `api` is the default)
├─ docker/nginx.conf                 SPA + reverse proxy /api
├─ docker-compose.yml                db → api (+ web with the `web` profile)
├─ render.yaml                       Render Blueprint for the API
└─ vercel.json                       frontend build + /api proxy to Render
```

API module dependencies go in one direction: `presentation → application → domain ← infrastructure`. The application layer works with ports (`CardsRepository`, `UsersRepository`, `RefreshTokenRepository`, `Clock`); Prisma lives only in infrastructure.

## 2. Database schema

Full DDL — [`apps/api/prisma/migrations/20260926000000_init/migration.sql`](apps/api/prisma/migrations/20260926000000_init/migration.sql).

| Table                  | Key fields                                                                                                       | Notes                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `users`                | `username` PK, `email` UNIQUE, `password_hash`, `role` (enum), `teacher_id` FK→users, `teacher_status` (enum)    | CHECK: `teacher_id` and `teacher_status` are either both NULL or both set |
| `word_cards`           | `id` UUID PK, `user_id` FK, `name`, `means`, `used`, `n`, `v`, `adj`, `adv`, `collocations`, `topic TEXT[]`, `k` | index `(user_id, name)`                                                   |
| `card_random_progress` | `card_id` PK/FK, `repetition_step` SMALLINT, `locked_until` TIMESTAMPTZ                                          | CHECK 1..6; no row = the card has not been drawn yet                      |
| `refresh_tokens`       | `id` (= `jti`), `user_id`, `expires_at`, `revoked_at`, `replaced_by_id`                                          | rotation + reuse detection                                                |
| `word_drafts`          | `id` UUID PK, `user_id` FK, `word`, `meaning`, `added_by` FK→users (teacher, nullable), `created_at`             | inbox; index `(user_id, created_at)`                                      |

A card's `userId` in the DB is NOT NULL: guest cards never reach the DB — they live in LocalStorage with `userId: null`.

## 3. Key decisions

### Spaced random draw (5·n days)

One algorithm for both modes — `libs/shared/src/spaced-repetition.ts`:

```ts
advanceProgress(progress, now); // n=1 → +5d, n=2 → +10d … n=6 → +30d; n: 6 → 1
isCardAvailable(progress, now); // no progress yet, or lockedUntil <= now
```

- **Guest:** `LocalCardsRepository.drawRandom()` filters ids through `pickRandomAvailableId` and stores `{ [cardId]: { n, lockedUntil } }` under the `wl.guest.randomProgress` key.
- **Server:** `RandomCardService` → `PrismaCardsRepository.drawRandom()` runs, in a single transaction,
  `SELECT … LEFT JOIN card_random_progress … WHERE p.card_id IS NULL OR p.locked_until <= now ORDER BY random() LIMIT 1 FOR UPDATE OF c SKIP LOCKED`
  plus an upsert of the progress. The transition rule is passed down from the application layer using the same `advanceProgress`.
- If everything is locked, the API returns `{ cardId: null, nextAvailableAt }`, and the UI shows when the next card will become available.

### StorageService (LocalStorage ↔ API)

`CardStorageService` implements the same `CardsRepository` interface as both strategies and switches between them via a `computed()` on `AuthService.isAuthenticated()`. Components don't know where the data lives; pages subscribe to `storage.mode()` and reload data on login/logout. Corrupted LocalStorage entries are discarded one by one using Zod.

After signing in, the account page shows a **"Guest data in this browser"** block: `POST /api/cards/import` transfers cards together with their timers (ids are regenerated, progress is re-linked).

### Auth

- Access JWT (1 day) — `auth` cookie, `Path=/`. Refresh JWT (30 days, with `jti`) — `refresh` cookie, `Path=/api/auth`, so the browser doesn't send it with every request. Both are `HttpOnly; Secure; SameSite=Strict`.
- Every `/api/auth/refresh` call **rotates** the token. If a rotated token is used again more than 10 s later, this is treated as theft and all of the user's sessions are revoked. A parallel refresh from two tabs (≤ 10 s) is allowed. A token is not accepted at all after logout.
- `authRefreshInterceptor` (functional): 401 → one shared refresh for all parallel requests (`TokenRefreshService` + `shareReplay`) → retry of the original request. If the refresh fails, the app switches to guest mode; if a session was active, it redirects to `/login?returnUrl=…`.
- Session status is determined in `provideAppInitializer` via `/api/auth/me`, before the first navigation.

### Bilingual UI (UA / EN)

The library is [Transloco](https://jsverse.gitbook.io/transloco) (`@jsverse/transloco`); translations live in `apps/web/public/i18n/ua.json` and `en.json` and are loaded on demand.

- **Language selection:** a `UA | EN` switcher in the header. The choice is saved in LocalStorage (`wl.lang`); without it, the browser language is used (`uk*` → UA, `en*` → EN, otherwise UA).
- `LanguageService` loads the dictionary before the first render (no "flicker" of raw keys), sets `<html lang="uk|en">`, the locale for `Intl` (dates in toasts) and the Zod locale.
- **Templates:** `{{ 'cards.list.title' | transloco }}`, with parameters — `{{ 'cards.view.topics' | transloco: { count: n } }}`; in TS — `TranslocoService.translate()`.
- **Tab titles:** `title` in routes is an i18n key; `TranslatedTitleStrategy` translates it and updates it when the language changes.
- **API errors:** the backend returns `{ statusCode, code, message }` (codes in `@wl/shared/api-errors.ts`, `message` in English for logs); `ErrorTranslator` shows `errors.<code>`. If the API is unreachable, it shows "Server is unavailable".
- **Validation:** custom messages in Zod schemas are `validation.*` keys; standard ones (min/max…) are localized by Zod itself (`z.config(uk()/en())`). Errors already shown on the page are re-translated when the language is switched: the `computed()` depends on the language signal.
- **Adding a language:** a new `<lang>.json` + the code in `APP_LANGS` (`core/i18n/i18n.config.ts`) and in `LANGS` of the check script.
- `npm run i18n:check -w @wl/web` (part of `npm test`) fails if a key is missing or a value is empty in one of the files, or if a key from the code, an API error code or a `validation.*` key is missing from the dictionary; unused keys are reported as warnings.

### Text-to-speech (Web Speech API)

The browser's built-in `speechSynthesis`: no third-party services, keys or text length limits. Code — `apps/web/src/app/core/speech/`.

- `SpeechService` picks an English voice with the required accent, preferring "natural" ones (Natural / Neural / Online / Google), and saves the accent and rate in LocalStorage (`wl.speech.accent`, `wl.speech.rate`).
- Long text is split into sentences (`Intl.Segmenter`), and overly long sentences into chunks of ≤ 220 characters that are spoken one after another: otherwise Chrome cuts off network voices after roughly 15 s.
- `wl-speak-button` — a 🔊 / ⏹ button; `wl-spoken-text` highlights the word being spoken (`boundary` events; Google network voices in Chrome don't send them — in that case speech plays without highlighting).
- `wl-selection-speaker` — a floating "Speak selection" button above the selected fragment in a card (double-clicking a word works too); on touch screens it appears below the selection so it doesn't cover the system menu.
- The translation (`means`) is not spoken; navigating to another page stops speech; if the browser has no English voices, the buttons are hidden.
- Voice quality depends on the browser and OS: the best are Edge (Microsoft Natural) and Chrome (Google). For consistent studio-quality voices, a backend endpoint with Google Cloud TTS / Azure and an audio cache can be added in the future — the UI components won't change.

### Teacher ↔ student

```
student PUT /profile/teacher        → pending   (can be repeated: same or a different teacher)
teacher POST requests/:u/accept     pending  → accepted
teacher POST requests/:u/reject     pending  → rejected
teacher DELETE students/:u          accepted → rejected ("Remove"; the student sees the status and can send a request again)
```

Transitions are atomic (`updateMany` with a condition on the current status). A teacher sees cards only of students with the `accepted` status.

### Inbox, search, duplicates, sharing

- **Inbox rules** (server and guest mode share them): a word already in the inbox, or already a card name, is skipped and reported back (`skipped`), so the UI can say "already exists — Open". `POST /api/cards?fromDraft=<id>` creates the card and deletes the draft in one transaction.
- **Search** — `GET /api/cards?q=` narrows rows with `ILIKE` over `name, n, v, adj, adv`, then the shared `searchCards()` orders them (name prefix → name contains → word-form match). Guests use the same function over LocalStorage.
- **Duplicates** — `findCardDuplicates()` (shared) normalises case, spaces and leading `to / a / an / the`, and splits word-form fields on `, ; /`. `POST /api/cards` also enforces the exact-name rule (409 `CARD_EXISTS` with `meta.cardId`) in case two tabs race.
- **Sharing with the teacher** reuses the teacher's read-only pages — `/students/<me>/cards/<id>` or `/students/<me>?view=inbox&draft=<id>` (the word is highlighted). No public tokens: only the accepted teacher can open it; a signed-out teacher goes through login and comes back; the student opening their own link lands on their own card. On phones the system share sheet is used, on desktop the link is copied.

## 4. API

| Method         | Path                                                     | Description                                                                   |
| -------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| POST           | `/api/auth/register` · `/login` · `/refresh` · `/logout` | public                                                                        |
| GET            | `/api/auth/me`                                           | profile                                                                       |
| GET/POST       | `/api/cards`                                             | list (`id`, `name`; `?q=` searches name/n/v/adj/adv) / create (`?fromDraft=`) |
| GET            | `/api/cards/duplicates?name=`                            | `{ exact, related }` before creating a card                                   |
| GET/POST       | `/api/drafts`                                            | inbox list (newest first) / add `{ items: [{ word, meaning }] }`              |
| DELETE         | `/api/drafts/:id`                                        | remove from inbox                                                             |
| POST           | `/api/cards/random`                                      | random draw with timer                                                        |
| POST           | `/api/cards/import`                                      | import guest cards                                                            |
| GET/PUT/DELETE | `/api/cards/:id`                                         | card (GET has no side effects)                                                |
| POST           | `/api/cards/:id/view`                                    | open a card, `k + 1`                                                          |
| POST           | `/api/cards/:id/topics`                                  | add a paragraph                                                               |
| DELETE         | `/api/cards/:id/topics/:index`                           | delete a paragraph (body `{ text }` guards against deleting the wrong one)    |
| GET            | `/api/teachers?query=`                                   | search teachers                                                               |
| PUT/DELETE     | `/api/profile/teacher`                                   | request / unlink (student)                                                    |
| GET            | `/api/teacher/requests` · `/students`                    | teacher                                                                       |
| POST           | `/api/teacher/requests/:u/accept` · `/reject`            | teacher                                                                       |
| DELETE         | `/api/teacher/students/:u`                               | teacher                                                                       |
| GET            | `/api/teacher/students/:u/cards[/:id]`                   | student's cards, read-only (`?q=` search)                                     |
| GET/POST       | `/api/teacher/students/:u/drafts`                        | student's inbox / add a "quick word" (marked `addedBy`)                       |
| DELETE         | `/api/teacher/students/:u/drafts/:id`                    | only words the teacher added                                                  |
| GET            | `/api/health`                                            | API and DB status (public)                                                    |

## 5. Good to know

- **Angular 21, not 22.** Angular 22 requires Node ≥ 22.22.3; 21 runs on Node 20.19+/22.12+. To upgrade: `ng update @angular/core@22 @angular/cli@22`.
- **The migrations were written by hand** in the format Prisma generates (the schema-engine binary was unavailable in the development environment). It has been applied and tested on PostgreSQL 17. If `prisma migrate dev` suggests a small diff, it is cosmetic.
- **`k` is not editable** via the form: it is an internal counter. A teacher opening a student's card does not increment `k`.
- **"Student's random word"** is picked on the frontend from the already loaded list and doesn't write anything.
- Expired refresh tokens are cleaned up when the API starts; as load grows, this should be moved to a cron job.
- Rate limiting (`@nestjs/throttler`) keeps counters in memory — multiple API instances need a shared store (Redis).
- Without the dev proxy (frontend on a different origin), set `WEB_ORIGIN`. But with `SameSite=Strict`, the frontend and API must be on the same site.
- **Docker and `COOKIE_SECURE=true`:** browsers accept Secure cookies on `http://localhost`, but not on `http://<IP address>`. If you open the app from another device on the network without HTTPS, set `COOKIE_SECURE=false` in `.env` (local network only) or set up HTTPS.
- The `api` image contains all of the monorepo's `node_modules` (including dev dependencies), so it weighs a few hundred MB. For production, a separate `npm ci --omit=dev` for the API alone would be worth doing.

## 6. Deployment: Vercel (frontend) + Render (API) + Neon (PostgreSQL)

Current production: **https://word-learning-phi.vercel.app** → API `https://wordloop-api.onrender.com` → Neon (Frankfurt).

```
Browser → https://word-learning-phi.vercel.app
            ├─ Angular static files (Vercel CDN)
            └─ /api/*  →  rewrite (proxy) → https://wordloop-api.onrender.com/api/*  →  Neon Postgres
```

From the browser's point of view, the frontend and API are on the same domain (`*.vercel.app`), so HttpOnly cookies with `SameSite=Strict` work without CORS and without code changes. The configs are in the repository: `vercel.json`, `render.yaml`, `Dockerfile` (the `api` stage is the default target).

### Step 1. Neon — database

1. **New Project** → Postgres 17, region **AWS Europe Central 1 (Frankfurt)** (close to Render).
2. **Connect** → turn off **Connection pooling** (Prisma migrations need a direct connection) → copy the `postgresql://…neon.tech/neondb?sslmode=require&channel_binding=require` string.

### Step 2. Render — API

1. **New → Blueprint** → connect the GitHub repository → Render reads `render.yaml`.
2. Paste the Neon string into the `DATABASE_URL` field → **Apply**. Render generates the JWT secrets itself.
3. The first deploy takes a few minutes (building the Docker image, then `prisma migrate deploy` creates the tables).
4. Check: `https://wordloop-api.onrender.com/api/health` → `{"status":"ok"}`.

> If the name `wordloop-api` is taken, Render gives an address with a suffix (shown at the top of the service page). In that case, replace the address in `vercel.json` (`rewrites[0].destination`) and push.

### Step 3. Vercel — frontend

1. **Add New → Project** → import the same repository.
2. **Root Directory** — the repository root (`./`). Vercel may suggest `apps/api` with the NestJS preset on its own — change it to the root.
3. **Application Preset** — Other (`vercel.json` has `"framework": null`, which takes precedence). Leave **Build and Output Settings** alone — they come from `vercel.json`.
4. **Environment Variables** are not needed: if Vercel "found" variables from `apps/api/.env.example`, delete them.
5. **Deploy** → the site will be at `https://<project>.vercel.app` (ours is https://word-learning-phi.vercel.app).

### How it works from here

- Every `git push` to `main` updates both the frontend and the API. Render rebuilds the API only when the backend changes (`buildFilter`); Vercel builds the frontend on every push.
- **Render free tier:** the API goes to sleep after 15 minutes without requests and takes about a minute to wake up. The frontend smooths this over (`apps/web/src/app/core/server/`):
  - a request that hangs for more than 2.5 s shows a non-blocking "Waking up the server…" banner with a seconds counter;
  - GET requests that fail with 0/502/503/504 are retried with backoff for about 75 s (POST is not retried — it may already have run);
  - guests start instantly without waiting for `/api/auth/me` (a `wl.session` hint in LocalStorage, since the cookies themselves are HttpOnly), and the server is warmed up in the background via `/api/health`, so it is usually awake by the time they sign in;
  - a signed-in user sees a splash screen from `index.html` while the session is restored; if the server never responds, the app falls back to guest mode with a toast.
- **Neon free tier:** 0.5 GB; the database sleeps after 5 minutes of inactivity and wakes up in a fraction of a second.
- Sign-in and registration are limited to 10 attempts per minute per IP (`@nestjs/throttler`, a 429 response → "Too many attempts").
- API environment variables on Render: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `NODE_ENV=production`.
