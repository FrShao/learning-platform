# syntax=docker/dockerfile:1.7
# Learning Platform — apps/api (multi-stage)
# Build context: monorepo root
#   docker build -f apps/api/Dockerfile --target runner -t lp-api .

ARG NODE_VERSION=26

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/domain/package.json ./packages/domain/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
COPY packages/tsconfig/package.json ./packages/tsconfig/

RUN pnpm install --frozen-lockfile || pnpm install

# ---------- build ----------
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm --filter @lp/domain build \
 && pnpm --filter @lp/db build \
 && pnpm --filter @lp/config build \
 && pnpm --filter @lp/api build \
 && pnpm deploy --filter=@lp/api --prod /out

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache wget \
 && addgroup -g 1000 -S lp \
 && adduser -u 1000 -S lp -G lp
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=lp:lp /out ./
COPY --chown=lp:lp scripts/docker-entrypoint-api.sh /usr/local/bin/docker-entrypoint-api.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-api.sh

USER lp
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["docker-entrypoint-api.sh"]
CMD ["node", "dist/index.js"]
