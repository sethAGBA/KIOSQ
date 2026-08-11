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
# whatsapp-web.js requires Chromium/Puppeteer → use the full slim image
# and install the necessary system libraries.
FROM node:22-slim AS runtime

WORKDIR /app

# Install Chromium dependencies required by Puppeteer (whatsapp-web.js)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    wget \
 && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Persistent volume for WhatsApp session data (avoids QR scan on every restart)
VOLUME ["/app/.wwebjs_auth"]

# Run as non-root user
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "dist/whatsapp/index.js"]
