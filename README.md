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
