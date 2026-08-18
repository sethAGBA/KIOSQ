# =============================================================================
# Bot WhatsApp Kiosq — Image Docker multi-stage
# Build context : répertoire bot/
# Usage         : docker build -f whatsapp/Dockerfile -t kiosq-whatsapp-bot .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — builder : compile TypeScript → JS
# -----------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:whatsapp

# -----------------------------------------------------------------------------
# Stage 2 — runtime : image finale avec Chromium pour whatsapp-web.js
# -----------------------------------------------------------------------------
FROM node:22-slim AS runtime

WORKDIR /app

# Dépendances système requises par Puppeteer / Chromium
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

# Pointer whatsapp-web.js vers Chromium du système (pas de téléchargement Puppeteer)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Dépendances de production uniquement
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le JS compilé depuis le builder
COPY --from=builder /app/dist ./dist

# Créer le dossier de session et donner les permissions à l'utilisateur node
RUN mkdir -p /app/.wwebjs_auth && chown -R node:node /app/.wwebjs_auth

# Exécuter en non-root
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "dist/whatsapp/index.js"]
