# ---------- BUILD STAGE ----------
FROM node:22-alpine AS builder

WORKDIR /app

# prisma needs openssl on alpine
RUN apk add --no-cache openssl

# install dependencies
COPY package*.json ./
RUN npm ci

# copy source
COPY . .

ARG DATABASE_URL="postgresql://postgres:password@localhost:5432/dummy"
ENV DATABASE_URL=$DATABASE_URL

# generate prisma client
RUN npx prisma generate

# build nestjs
RUN npm run build


# ---------- PRODUCTION STAGE ----------
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

# copy dependencies
COPY --from=builder /app/node_modules ./node_modules

# copy compiled app
COPY --from=builder /app/dist ./dist

# copy prisma schema
COPY --from=builder /app/prisma ./prisma

COPY package*.json ./

ENV NODE_ENV=production

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]