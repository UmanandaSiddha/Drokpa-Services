# ---------- BUILD STAGE ----------
FROM node:22-alpine AS builder

WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm ci

# copy source
COPY . .

# generate prisma client
RUN npx prisma generate

# build nestjs
RUN npm run build


# ---------- PRODUCTION STAGE ----------
FROM node:22-alpine

WORKDIR /app

# copy dependencies
COPY --from=builder /app/node_modules ./node_modules

# copy compiled app
COPY --from=builder /app/dist ./dist

# copy prisma schema + migrations
COPY --from=builder /app/prisma ./prisma

# copy package.json for npm scripts
COPY package*.json ./

ENV NODE_ENV=production

EXPOSE 4000

# run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]