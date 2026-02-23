# AI Healthcare Backend + Database (Frontend UI Unchanged)

This repository keeps your existing UI intact and stabilizes the backend/database layer that powers it.

## Scope of this phase
- Backend: Node.js + Express (`server/`)
- Database: MongoDB + Mongoose
- UI: **untouched** (no redesign/replacement)

## Core decisions implemented
- Internal doctor role is `nurse`
- OTP verification is required for login completion
- API base path is `/api`
- Ledger is DB-backed (no blockchain write dependency)

## Quick start
0. Node.js baseline:
   - Use Node `>=22.13` (recommended via `.nvmrc`: `22.13.0`)
1. Install dependencies:
   - `npm run install-all`
2. Start MongoDB (Docker):
   - `npm run db:up`
3. Configure backend env:
   - Copy `server/.env.example` to `server/.env` and set secrets
4. Run backend:
   - `npm run dev:server`
5. (Optional) Run frontend:
   - `npm run dev:client`

## Backend scripts
- Start backend (dev): `npm run dev:server`
- Start backend (prod mode): `npm run start:server`
- Run data migration: `npm run backend:migrate`
- Seed core users: `npm run backend:seed`
- Stop DB container: `npm run db:down`

## Backend API coverage
Implemented and active under `/api`:
- Auth: register, login, OTP challenge/verify/resend, logout, session
- Appointments: list/create/update + reservations alias
- Settings: get/update current user settings
- Admin/support: users, ledger, access requests, AI alert audit action, encrypted audit backup
- Health check: `GET /api/health`

Full endpoint details: `server/docs/API.md`

## Documentation
- API reference: `server/docs/API.md`
- Deployment/runtime: `server/docs/DEPLOYMENT.md`
- Maintenance runbook: `server/docs/MAINTENANCE.md`
- Security notes: `server/docs/SECURITY.md`
- DB schema: `server/docs/DB_SCHEMA.md`

## GitHub Desktop troubleshooting
- If GitHub Desktop shows no patch, verify tracked file changes with `git status`.
- Changes in ignored paths like `node_modules/` and `dist/` do not appear as Git patches.
- For diagnosis, run `git status --short --ignored` to see ignored-folder churn.

## Dependency audit notes (February 22, 2026)
- `npm run audit:prod` is clean (`0` vulnerabilities for client/server production dependencies).
- `npm run audit:all` still reports dev-only advisories in the client lint/tooling chain (`eslint`/`minimatch`/`ajv` transitive advisories).
- Current npm remediation guidance proposes unsafe/breaking changes (including `eslint@4` downgrade), so those findings are tracked for upstream toolchain resolution.
- Follow-up owner: repository maintainers.
- Next review target: on the next dependency refresh cycle or when npm advisory data for ESLint v9+ is updated.
