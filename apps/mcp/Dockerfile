# syntax=docker/dockerfile:1.7
# Learning Platform — apps/mcp (multi-stage)
# Build context: monorepo root
#   docker build -f apps/mcp/Dockerfile --target runner -t lp-mcp .

ARG NODE_VERSION=22

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/mcp/package.json ./apps/mcp/
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
 && pnpm --filter @lp/mcp build \
 && pnpm deploy --filter=@lp/mcp --prod /out

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache wget \
 && addgroup -g 1000 -S lp \
 && adduser -u 1000 -S lp -G lp
WORKDIR /app

ENV NODE_ENV=production
ENV MCP_HTTP_PORT=3100

COPY --from=build --chown=lp:lp /out ./

USER lp
EXPOSE 3100
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3100/health || exit 1

CMD ["node", "dist/index.js"]
