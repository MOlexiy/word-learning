# syntax=docker/dockerfile:1.7
# Один Dockerfile, дві цілі: `api` (NestJS) і `web` (Angular у nginx).
# `api` — остання стадія, тобто ціль за замовчуванням: Render збирає її без додаткових налаштувань.
# docker compose обирає ціль явно через `target`.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- базовий образ Node (openssl потрібен рушіям Prisma) ----------
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- залежності ----------
# Спершу лише те, що потрібно для `npm ci` + postinstall (build @wl/shared, prisma generate),
# щоб шар з node_modules кешувався між збірками, поки не змінились залежності чи схема.
FROM base AS deps
COPY package.json package-lock.json ./
COPY libs/shared ./libs/shared
COPY apps/api/package.json apps/api/prisma.config.ts ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/web/package.json ./apps/web/
RUN npm ci

# ---------- вихідний код ----------
FROM deps AS source
COPY . .

# ---------- Web ----------
FROM source AS web-build
ENV NG_CLI_ANALYTICS=false
RUN npm run build -w @wl/web

FROM nginx:1.29-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 80

# ---------- API ----------
FROM source AS api-build
RUN npm run build -w @wl/api

FROM base AS api
ENV NODE_ENV=production
COPY --chown=node:node --from=api-build /app/node_modules ./node_modules
COPY --chown=node:node --from=api-build /app/package.json ./package.json
COPY --chown=node:node --from=api-build /app/libs/shared/package.json ./libs/shared/package.json
COPY --chown=node:node --from=api-build /app/libs/shared/dist ./libs/shared/dist
COPY --chown=node:node --from=api-build /app/apps/api/package.json /app/apps/api/prisma.config.ts ./apps/api/
COPY --chown=node:node --from=api-build /app/apps/api/prisma ./apps/api/prisma
COPY --chown=node:node --from=api-build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3000
# Міграції застосовуються при кожному старті (idempotent), потім стартує сервер.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
