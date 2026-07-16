# ---- Build stage ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# better-sqlite3 braucht Build-Tools, falls kein Prebuild passt
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV CONTROL_DIR=/control
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Fallback-Version, falls control/version.json fehlt (update.sh schreibt sie sonst)
ARG GIT_SHA=""
ENV GIT_SHA=$GIT_SHA

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m achilles \
    && mkdir -p /data && chown achilles:nodejs /data

# Standalone-Output: minimaler Server + nur benötigte node_modules
COPY --from=builder --chown=achilles:nodejs /app/.next/standalone ./
COPY --from=builder --chown=achilles:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=achilles:nodejs /app/public ./public

USER achilles
EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "server.js"]
