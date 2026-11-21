# syntax=docker/dockerfile:1.7
#
# Family Habit API — production image.
#   target "runtime" (default): compiled API, production dependencies only, non-root user.
#   target "migrate":           one-off job: `prisma migrate deploy` + idempotent reference seed.
#
# Build: docker build -t family-habit-api ./backend
# The image contains no secrets; all configuration comes from environment variables.

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV CI=true \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# ── Full dependency tree + generated Prisma client ──
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Only needed so prisma.config.ts can load during `prisma generate`; never used to connect.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm ci

# ── Compile ──
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Migration + seed job (needs the Prisma CLI and tsx from devDependencies) ──
FROM build AS migrate
# Prisma's schema engine (migrate) needs OpenSSL; the slim base image does not ship it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ── Runtime ──
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# --ignore-scripts: skips the `prisma generate` postinstall; the generated client is compiled
# into dist/. argon2 ships prebuilt binaries, so no build toolchain is needed.
# @prisma/client pulls the Prisma CLI, Studio, schema engines and TypeScript in as peers; the
# driver-adapter runtime needs none of them, so they are removed (~200 MB).
RUN npm ci --omit=dev --ignore-scripts \
  && rm -rf node_modules/prisma node_modules/typescript node_modules/effect \
     node_modules/@prisma/studio-core node_modules/@prisma/dev node_modules/@prisma/engines \
     node_modules/@prisma/config \
  && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
