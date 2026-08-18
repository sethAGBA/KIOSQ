# =============================================================================
# Kiosq — Frontend + API
# Build context : racine du repo
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — deps : installe toutes les dépendances
# -----------------------------------------------------------------------------
FROM node:22-slim AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2 — builder : compile le frontend React + TypeScript
# -----------------------------------------------------------------------------
FROM deps AS builder

WORKDIR /app
COPY . .

# Build du frontend (vite) — génère dist/
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runtime : image finale légère
# -----------------------------------------------------------------------------
FROM node:22-slim AS runtime

WORKDIR /app

# Dépendances de prod uniquement
COPY package*.json ./
RUN npm ci --omit=dev

# Copier les sources (server.ts + api/) et le frontend compilé
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api ./api
COPY --from=builder /app/db ./db
COPY server.ts ./
COPY tsconfig*.json ./

# tsx pour exécuter TypeScript directement en prod
RUN npm install -g tsx

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/auth/me').then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))"

CMD ["tsx", "server.ts"]
