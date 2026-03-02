# Multi-stage Dockerfile for Next.js (production)
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
# Ensure public exists so the final image copy step never fails if repo has no public/
RUN mkdir -p public
RUN npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/.env ./

EXPOSE 3000

CMD ["npm", "start"]
