# SPDX-License-Identifier: Apache-2.0
FROM node:22-bookworm-slim@sha256:2fc5ec124496f2fb49b8da251c8b4b674c6b96c1f2176f6c77fa23ec7e9af7d7 AS base

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NOTE: `next build` downloads fonts via next/font/google at build time,
# so this stage needs outbound HTTPS access to fonts.googleapis.com.
# CI builds have this; air-gapped builders must mirror the font CSS/files
# or swap to next/font/local before building offline.
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Run as the unprivileged `node` user from the base image.
USER node

EXPOSE 3000

# Liveness only — readiness (/api/health/ready) also checks storage config,
# which a fresh container intentionally may not have yet.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]