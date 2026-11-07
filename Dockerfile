# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.23.4
ARG CLAUDE_CODE_VERSION=2.1.316
ARG CODEX_VERSION=0.165.0
# Antigravity CLI 1.4.12, from Google's release manifest; the SHA-512 it publishes was checked
# before pinning these SHA-256 digests.
ARG ANTIGRAVITY_CLI_RELEASE=1.4.12-4768735748292608
ARG ANTIGRAVITY_CLI_SHA256_AMD64=3368d1923fc869f21ec8fce83252a8c96c89283aac9393958ac91fbf7a3949e4
ARG ANTIGRAVITY_CLI_SHA256_ARM64=30dd61ebe1f0a8829057ea2de29dad08c710dd972ce4c02949f51e632135a86b

FROM node:${NODE_VERSION}-bookworm-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV PNPM_CONFIG_INJECT_WORKSPACE_PACKAGES=true
ENV NODE_OPTIONS=--max-old-space-size=1536

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ai/package.json apps/ai/package.json
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

FROM workspace AS ai-deployment

RUN --mount=type=cache,id=openmonetis-pnpm,target=/pnpm/store,sharing=locked \
    pnpm --filter @openmonetis/ai build \
    && pnpm --filter @openmonetis/ai deploy --prod /opt/openmonetis/ai

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
# Bank logos and the app icon embedded in the report emails, from the web's public folder.
COPY --chown=node:node apps/web/public/logos ./email-assets/logos
COPY --chown=node:node apps/web/public/icon-192.png ./email-assets/icon-192.png
ENV EMAIL_ASSETS_DIR=/app/email-assets

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

FROM scratch AS antigravity-amd64
ARG ANTIGRAVITY_CLI_RELEASE
ARG ANTIGRAVITY_CLI_SHA256_AMD64
ADD --checksum=sha256:${ANTIGRAVITY_CLI_SHA256_AMD64} \
  https://storage.googleapis.com/antigravity-public/antigravity-cli/${ANTIGRAVITY_CLI_RELEASE}/linux-x64/cli_linux_x64.tar.gz \
  /antigravity.tar.gz

FROM scratch AS antigravity-arm64
ARG ANTIGRAVITY_CLI_RELEASE
ARG ANTIGRAVITY_CLI_SHA256_ARM64
ADD --checksum=sha256:${ANTIGRAVITY_CLI_SHA256_ARM64} \
  https://storage.googleapis.com/antigravity-public/antigravity-cli/${ANTIGRAVITY_CLI_RELEASE}/linux-arm/cli_linux_arm64.tar.gz \
  /antigravity.tar.gz

FROM antigravity-${TARGETARCH} AS antigravity

FROM node:${NODE_VERSION}-bookworm-slim AS ai

ARG CLAUDE_CODE_VERSION
ARG CODEX_VERSION

ENV NODE_ENV=production
ENV AI_PORT=7003
ENV AI_HOMES_DIR=/data/homes
ENV AI_TOOLS_DIR=/data/tools

# The vendor CLIs are installed exactly as published, at reviewed versions, and never auto-update.
# They stay as the fallback when the installation admin activates a newer build in /data/tools.
# Codex verifies TLS with the system store, which the slim image does not ship.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global --no-fund --no-audit \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      "@openai/codex@${CODEX_VERSION}" \
    && npm cache clean --force \
    && mkdir -p /data/homes /data/tools \
    && chown -R node:node /data

# Antigravity ships a single binary; it signs in through a terminal that `script` (bsdutils,
# part of the base image) provides. Owned by root, so it cannot replace itself at runtime.
RUN --mount=type=bind,from=antigravity,target=/tmp/antigravity \
    tar -xzf /tmp/antigravity/antigravity.tar.gz -C /usr/local/bin antigravity \
    && mv /usr/local/bin/antigravity /usr/local/bin/agy \
    && chmod 0755 /usr/local/bin/agy \
    && command -v script

WORKDIR /app

COPY --from=ai-deployment --chown=node:node /opt/openmonetis/ai ./

USER node

VOLUME ["/data/homes", "/data/tools"]

EXPOSE 7003

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:7003/health').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "--import", "tsx", "src/index.ts"]

FROM node:${NODE_VERSION}-bookworm-slim AS migrator

ENV NODE_ENV=production

WORKDIR /app

COPY --from=migrator-deployment --chown=node:node /opt/openmonetis/migrator ./

USER node

CMD ["node_modules/.bin/drizzle-kit", "migrate"]
