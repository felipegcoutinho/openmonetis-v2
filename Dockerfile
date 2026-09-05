# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.16.0

FROM node:${NODE_VERSION}-bookworm-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV PNPM_CONFIG_INJECT_WORKSPACE_PACKAGES=true
ENV NODE_OPTIONS=--max-old-space-size=1536

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/validators/package.json packages/validators/package.json

RUN --mount=type=cache,id=openmonetis-pnpm,target=/pnpm/store,sharing=locked \
    pnpm install --lockfile-only --no-frozen-lockfile \
    && pnpm install --frozen-lockfile

COPY . .

RUN --mount=type=cache,id=openmonetis-pnpm,target=/pnpm/store,sharing=locked \
    pnpm install --offline --frozen-lockfile

FROM workspace AS api-deployment

RUN --mount=type=cache,id=openmonetis-pnpm,target=/pnpm/store,sharing=locked \
    pnpm --filter @openmonetis/api build \
    && pnpm --filter @openmonetis/api deploy --prod /opt/openmonetis/api

FROM workspace AS web-deployment

RUN --mount=type=cache,id=openmonetis-pnpm,target=/pnpm/store,sharing=locked \
    pnpm --filter @openmonetis/web build \
    && pnpm --filter @openmonetis/web deploy --prod /opt/openmonetis/web

FROM workspace AS migrator-deployment

RUN --mount=type=cache,id=openmonetis-pnpm,target=/pnpm/store,sharing=locked \
    pnpm --filter @openmonetis/db build \
    && pnpm --filter @openmonetis/db deploy /opt/openmonetis/migrator

FROM node:${NODE_VERSION}-bookworm-slim AS api

ENV NODE_ENV=production
ENV API_PORT=7001

WORKDIR /app

COPY --from=api-deployment --chown=node:node /opt/openmonetis/api ./
COPY --chown=node:node CHANGELOG.md /CHANGELOG.md

USER node

EXPOSE 7001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:7001/health').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "--import", "tsx", "src/index.ts"]

FROM node:${NODE_VERSION}-bookworm-slim AS web

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=7002

WORKDIR /app

COPY --from=web-deployment --chown=node:node /opt/openmonetis/web ./

USER node

EXPOSE 7002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:7002/robots.txt').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node_modules/.bin/srvx", "--prod", "--static", "../client", "dist/server/server.js"]

FROM node:${NODE_VERSION}-bookworm-slim AS migrator

ENV NODE_ENV=production

WORKDIR /app

COPY --from=migrator-deployment --chown=node:node /opt/openmonetis/migrator ./

USER node

CMD ["node_modules/.bin/drizzle-kit", "migrate"]
