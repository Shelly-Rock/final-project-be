# Stage 1: Development (dùng cho local)

FROM node:20-alpine AS development
WORKDIR /app
COPY package\*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Stage 2: Builder (build sản phẩm)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package\*.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production (chạy trên Render)

FROM node:20-alpine AS production
WORKDIR /app
COPY package\*.json ./
RUN npm ci --omit=dev --frozen-lockfile
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000

# Chạy migration và start ứng dụng

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
