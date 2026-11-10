# syntax=docker/dockerfile:1.7
# Learning Platform — apps/web (multi-stage)
# Build context: monorepo root
#   docker build -f apps/web/Dockerfile --target runner -t lp-web .

ARG NODE_VERSION=22

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/domain/package.json ./packages/domain/
COPY packages/tsconfig/package.json ./packages/tsconfig/

RUN pnpm install --frozen-lockfile || pnpm install

# ---------- build ----------
FROM deps AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN pnpm --filter @lp/domain build \
 && pnpm --filter @lp/web build

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache wget \
 && addgroup -g 1000 -S lp \
 && adduser -u 1000 -S lp -G lp
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Support Next.js standalone output when configured; fallback to full app copy
COPY --from=build --chown=lp:lp /app/apps/web/.next/standalone ./
COPY --from=build --chown=lp:lp /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=lp:lp /app/apps/web/public ./apps/web/public

USER lp
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/ || exit 1

# Adjust if framework differs (Vite static → nginx; Next standalone → node server.js)
CMD ["node", "apps/web/server.js"]
