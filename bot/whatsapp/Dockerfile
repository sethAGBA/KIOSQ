# Stage 1 — builder
# Build context: bot/ directory
# Usage: docker build -f whatsapp/Dockerfile .  (run from bot/)
FROM node:22-slim AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for tsc)
COPY package*.json ./
RUN npm ci

# Copy all source files needed for the build
COPY . .

# Compile TypeScript → dist/
RUN npm run build:whatsapp

# Stage 2 — runtime
FROM node:22-slim AS runtime

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Run as non-root user (built into node:22-slim)
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "dist/whatsapp/index.js"]
