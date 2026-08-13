# Development (local)
FROM node:20-alpine AS development
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

# Builder
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build

# Production
FROM node:20-alpine AS production
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]