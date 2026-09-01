# Development (local)
FROM node:20 AS development
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --unsafe-perm
COPY . .
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
RUN npx prisma generate
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

# Builder
FROM node:20 AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --unsafe-perm
COPY . .
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
RUN npx prisma generate
RUN pnpm run build
# KIỂM TRA CẤU TRÚC THƯ MỤC DIST
RUN ls -la ./dist
RUN find ./dist -name "main.js"

# Production
FROM node:20-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --unsafe-perm
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
RUN npx prisma generate
EXPOSE 3000
# SỬA CMD: chuyển sang dist/src/main.js
CMD ["sh", "-c", "node dist/src/main.js"]