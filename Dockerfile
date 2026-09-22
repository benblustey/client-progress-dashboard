# Multi-stage build for a small production image, matching Next.js's
# "standalone" output (see next.config.mjs). Works with Coolify's
# "Dockerfile" build pack out of the box.
#
# Uses pnpm (via corepack, bundled with Node 20+) to match the project's
# pnpm-lock.yaml — installing with npm here would ignore that lockfile and
# could resolve different dependency versions than what's tested locally.

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Purely for image provenance (visible via `docker inspect`) — CI passes
# these; a local `docker build .` with no --build-arg just leaves them blank.
ARG APP_VERSION=""
ARG GIT_SHA=""
LABEL org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.revision="$GIT_SHA"

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
