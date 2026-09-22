# Multi-stage build for a small production image, matching Next.js's
# "standalone" output (see next.config.mjs). Works with Coolify's
# "Dockerfile" build pack out of the box.
#
# Uses pnpm (via corepack, bundled with Node 20+) to match the project's
# pnpm-lock.yaml — installing with npm here would ignore that lockfile and
# could resolve different dependency versions than what's tested locally.
#
# deps/builder deliberately run on --platform=$BUILDPLATFORM (the CI
# runner's own architecture, amd64) even when the target image is
# linux/arm64. `pnpm install` and `next build` are extremely slow — and
# pnpm's worker-thread tarball extraction can outright hang — under QEMU
# emulation, so cross-compiling here avoids emulating them at all. This is
# safe because Next.js's standalone output traces only what the server
# actually `require()`s at runtime; this app doesn't use next/image or any
# other native-addon dependency, so nothing architecture-specific ends up in
# `.next/standalone`. Only the final `runner` stage — which just copies that
# plain-JS output into a base image and starts node — is built per target
# platform.
ARG BUILDPLATFORM

FROM --platform=$BUILDPLATFORM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# No --platform pin here: this stage builds for whichever target platform
# buildx is currently producing (each entry in `platforms:`), so the base
# image and `node` binary match the architecture the image will actually run
# on. It only copies the already-built plain-JS output from `builder`.
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
