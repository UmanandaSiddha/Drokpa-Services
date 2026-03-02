# ---------- BUILD STAGE ----------
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY . .

ARG DATABASE_URL="postgresql://postgres:password@localhost:5432/dummy"
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate
RUN npm run build


# ---------- PRODUCTION STAGE ----------
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY package*.json ./

ENV NODE_ENV=production

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]