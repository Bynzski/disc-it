FROM node:24-bookworm-slim AS builder
WORKDIR /app
# better-sqlite3 is built for the same Node ABI/libc as the runner.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY scripts ./scripts
ARG VITE_BASE_PATH=/disc-it/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN npm run test:leaderboard \
    && node --test scripts/hosting-test.cjs \
    && npm run test:thunderbird \
    && npm run build \
    && npm prune --omit=dev

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/scores.db
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
# server/courses.js imports the real course definitions from src.
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist
# Pre-create /app/data because the server mkdirs it even with an external DB_PATH.
RUN mkdir -p /app/data /data && chown node:node /app/data /data
USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server/index.js"]
