FROM node:23-alpine AS builder

WORKDIR /app

# Install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build


FROM node:23-alpine AS runner

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema and migrations
COPY prisma ./prisma

ENV NODE_ENV=production
EXPOSE 8080

# Run Prisma migrations and start the application
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"