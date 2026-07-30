# Implementation Plan: WhatsApp Bot Deployment

## Overview

Operational work to make `bot/whatsapp/` container-deployable. No new business logic — only build config, npm scripts, env documentation, graceful shutdown, Dockerfile, and a deployment guide. All tasks build incrementally toward a fully deployable Docker image.

## Tasks

- [ ] 1. Create `bot/whatsapp/tsconfig.json`
  - [ ] 1.1 Create `bot/whatsapp/tsconfig.json` with NodeNext module system
    - Set `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`
    - Set `outDir: "../dist/whatsapp"`, `rootDir: ".."` (covers `loadEnv.ts` import)
    - Include `"./**/*.ts"` and `"../loadEnv.ts"`
    - Exclude `**/*.test.ts` and `**/*.property.test.ts` from both `whatsapp/` and `../`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 2. Add npm scripts to `bot/package.json`
  - [ ] 2.1 Add `start:whatsapp` and `build:whatsapp` scripts
    - `"start:whatsapp": "tsx whatsapp/index.ts"`
    - `"build:whatsapp": "tsc -p whatsapp/tsconfig.json"`
    - Leave existing `start`, `build`, `generate-jwt`, `test` scripts unchanged
    - _Requirements: 1.1, 1.2_

- [ ] 3. Create `bot/whatsapp/.env.example`
  - [ ] 3.1 Write `.env.example` with all required and optional variables
    - List all 7 required vars: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `BOT_JWT`, `KIOSQ_API_URL`, `GEMINI_API_KEY`
    - List 2 optional vars with defaults: `WHATSAPP_BOT_PORT=3002`, `NLU_SCORE_SEUIL=0.6`
    - Add a comment per variable explaining its role and how to obtain/generate it
    - Note that `BOT_JWT` must be generated via `npm run generate-jwt` from `bot/`
    - Use descriptive placeholders only — no real secrets
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 4. Update `bot/.gitignore` for secret exclusion
  - [ ] 4.1 Ensure `bot/.gitignore` excludes `.env` and `whatsapp/.env`
    - Add entries for `whatsapp/.env`, `.env`, `.env.local` if not already present
    - Do not remove any existing entries
    - _Requirements: 8.2_

- [ ] 5. Implement graceful shutdown in `bot/whatsapp/index.ts`
  - [ ] 5.1 Capture `server` reference from `startServer()` and add shutdown handler
    - Assign the return value of `startServer(...)` to a `server` variable
    - Define `shutdown(signal: string)` that:
      1. Logs `[main] Arrêt en cours (${signal})…`
      2. Calls `clearInterval(timer)` and logs `[main] Poller arrêté`
      3. Calls `server.close(cb)` — in `cb` logs `[main] Serveur HTTP fermé — exit 0` and calls `process.exit(0)`
      4. Sets a `setTimeout` of 10 000 ms that logs `[main] Timeout arrêt — exit forcé` and calls `process.exit(1)`
    - Register `process.on('SIGTERM', () => shutdown('SIGTERM'))` and `process.on('SIGINT', () => shutdown('SIGINT'))`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 5.2 Write property tests for graceful shutdown
    - Create `bot/whatsapp/shutdown.property.test.ts`
    - Use `fast-check` (already in devDependencies) with vitest
    - **Property 1: Clean shutdown exits 0** — for any scenario where `server.close` calls back within timeout, assert `process.exit` called with `0`
      - **Validates: Requirements 5.4**
    - **Property 2: Timeout shutdown exits 1** — for any scenario where `server.close` never calls back, assert `process.exit` called with `1`
      - **Validates: Requirements 5.5**
    - **Property 3: SIGINT === SIGTERM symmetry** — for any shutdown scenario, assert identical exit code and call order regardless of signal received
      - **Validates: Requirements 5.6**
    - **Property 4: Poller cleared before server.close** — for any bot state, assert `clearInterval` is always called before `server.close()`
      - **Validates: Requirements 5.3**
    - Each property runs minimum 100 iterations
    - Follow `*.property.test.ts` naming convention already used in the project

- [ ] 6. Checkpoint — build and shutdown tests pass
  - Run `npm run build:whatsapp` from `bot/` and confirm it produces `dist/whatsapp/index.js` without TypeScript errors.
  - Run `vitest --run bot/whatsapp/shutdown.property.test.ts` and confirm all 4 properties pass.
  - Ask the user if questions arise.

- [ ] 7. Create `bot/whatsapp/Dockerfile`
  - [ ] 7.1 Write multi-stage Dockerfile for the whatsapp bot
    - **Stage 1 — builder** (`node:22-slim`):
      - `WORKDIR /app`
      - Copy `package*.json`, run `npm ci`
      - Copy all source files
      - Run `npm run build:whatsapp`
    - **Stage 2 — runtime** (`node:22-slim`):
      - `WORKDIR /app`
      - Copy `package*.json`, run `npm ci --omit=dev`
      - Copy `dist/` from builder stage
      - `USER node` (non-root)
      - `EXPOSE 3002`
      - `HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget -qO- http://localhost:3002/health || exit 1`
      - `CMD ["node", "dist/whatsapp/index.js"]`
    - Do NOT copy any `.env` files
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 8.5_

- [ ] 8. Create `.dockerignore` files
  - [ ] 8.1 Create `bot/.dockerignore` (build context is `bot/`)
    - Exclude: `node_modules/`, `dist/`, `*.test.ts`, `*.property.test.ts`, `.env`, `.env.local`, `whatsapp/.env`, `whatsapp/.env.local`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 9. Write deployment guide `bot/whatsapp/README.md`
  - [ ] 9.1 Create `bot/whatsapp/README.md` with full deployment documentation
    - **Prerequisites** — Node.js 22+, npm, Docker (optional)
    - **Local development** — copy `.env.example`, fill in vars, run `npm run start:whatsapp`
    - **Environment variables table** — all 9 vars with required/optional, description, example value
    - **Docker build and run** — `docker build` command from `bot/` using `-f whatsapp/Dockerfile`, `docker run` with `--env-file` or `-e` flags
    - **Railway deployment** — service settings, env vars, health check path, start command
    - **Render deployment** — service type, build command, start command, env vars, health check path
    - **WhatsApp webhook configuration** — Meta Developer Portal steps, webhook URL format (`https://<HOST>/webhook`), verify token setup
    - **BOT_JWT generation and rotation** — `npm run generate-jwt`, token lifetime, how to redeploy after rotation
    - **API endpoints** — `GET /health`, `GET /webhook`, `POST /webhook`
    - **Troubleshooting** — common startup failures (missing env vars, port conflict, SIGTERM not handled)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

- [ ] 10. Final checkpoint — all artifacts in place
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The build context for Docker is always the `bot/` directory: `docker build -f whatsapp/Dockerfile .` (run from `bot/`)
- `tsconfig.json` must set `rootDir: ".."` (i.e. `bot/`) because `index.ts` imports `../loadEnv.js`
- Property tests use `fast-check` already present in `bot/package.json` devDependencies (v4.9.0)
- The `.env` loading in `loadEnv.ts` is already silent when the file is absent — no changes needed there

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "4.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["5.1", "8.1"] },
    { "id": 3, "tasks": ["5.2"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["9.1"] },
    { "id": 6, "tasks": ["11.1", "11.3"] },
    { "id": 7, "tasks": ["11.2", "11.4", "12.1", "13.1"] }
  ]
}
```

- [ ] 11. Normalisation du numéro de téléphone client
  - [ ] 11.1 Create `src/lib/phone.ts` exporting `normalizePhone`
    - Export `normalizePhone(raw: string): string` that strips `+`, spaces, `-`, `(`, `)`
    - Implementation: `return raw.replace(/[\s\-\(\)\+]/g, '');`
    - Pure function — no side effects, no imports
  - [ ] 11.2 Apply `normalizePhone` in `ClientsPage.tsx` before API call
    - Import `normalizePhone` from `@/lib/phone`
    - In `handleSubmit`, before calling `clientsApi.create(form)` or `clientsApi.update(...)`, compute `const normalizedTel = form.telephone ? normalizePhone(form.telephone) : form.telephone` and spread it into the payload
    - Apply for both create and update paths
  - [ ] 11.3 Add `?telephone=` exact-match param to `api/clients/index.ts` GET handler
    - Read `const telephone = req.query.telephone as string | undefined;`
    - If `telephone` is defined, query with `and(eq(clients.tenantId, ctx.tenantId), eq(clients.telephone, telephone))` and return early
    - Place this branch before the existing `q` branch
    - Use `eq` from `drizzle-orm` (already imported)
  - [ ] 11.4 Write `src/lib/phone.property.test.ts` — Property 5
    - Use `fast-check` and vitest
    - **Property 5a**: for any arbitrary string, `normalizePhone(s)` contains only characters matching `/^[0-9]*$/`
    - **Property 5b**: for any arbitrary string, `normalizePhone(normalizePhone(s)) === normalizePhone(s)` (idempotent)
    - Run minimum 100 iterations each
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 12. Badge WhatsApp dans la liste clients
  - [ ] 12.1 Add WhatsApp badge in `ClientsPage.tsx` client name cell
    - Add `MessageCircle` to the existing `lucide-react` import in `ClientsPage.tsx`
    - In the client name `<p>`, add `{c.notes?.includes('WhatsApp') && <MessageCircle size={13} className="shrink-0 inline ml-1" style={{ color: '#25D366' }} />}` after `{c.nom}`
    - Badge must be inline and always visible (no hover required)
    - Existing type filters must be unaffected (they filter on `c.typeClient`, not on notes)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 13. Lien WhatsApp dans la fiche client
  - [ ] 13.1 Add conditional WhatsApp link in `src/pages/clients/ClientDetailPage.tsx`
    - Import `MessageCircle` from `lucide-react` if not already imported
    - Locate the phone number display section
    - Add below (or alongside) the phone display: `{client.telephone && (<a href={\`https://wa.me/${client.telephone}\`} target="_blank" rel="noopener noreferrer" ...>Contacter sur WhatsApp</a>)}`
    - Style with `color: '#25D366'` and include `<MessageCircle size={13} />` icon
    - Must NOT render when `client.telephone` is falsy
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
