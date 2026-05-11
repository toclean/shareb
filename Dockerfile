# ── Stage 1: Build the React client ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /build

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# ── Stage 2: Run the Express server ──────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Copy server source and install production deps
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./

# Copy the built React app so Express can serve it
COPY --from=builder /build/client/dist ./client/dist

# Default data dir (override with DATA_DIR env var + a volume mount)
ENV DATA_DIR=/data
ENV CLIENT_BUILD_DIR=/app/client/dist
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "index.js"]
