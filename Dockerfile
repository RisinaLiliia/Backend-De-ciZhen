# ---------- builder ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- runner ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV SWAGGER_ENABLED=false

# security: run as non-root
RUN groupadd --system app && useradd --system --gid app app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

USER app

EXPOSE 3000
CMD ["node", "dist/main.js"]
