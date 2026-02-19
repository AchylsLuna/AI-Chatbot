# Deployment & Runtime

## Stack
- Node.js 18+
- Express API
- MongoDB (recommended via Docker Compose for local)

## Environment variables
Use `server/.env.example` as the baseline.

Required values:
- `PORT`
- `MONGO_URI`
- `DB_NAME`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `BACKUP_PASSWORD`

OTP email transport:
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_HOST`

Optional:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CLIENT_URL`
- `FRONTEND_URL`

## Local deployment (backend-first)
1. Start MongoDB:
   - `npm run db:up`
2. Install dependencies:
   - `npm run install-all`
3. Configure env:
   - `cp server/.env.example server/.env`
4. Start backend:
   - `npm run dev:server`
5. Optional data setup:
   - `npm run backend:migrate`
   - `npm run backend:seed`

## Production notes
- Run backend via process manager (systemd/pm2/container).
- Restrict CORS (`CLIENT_ORIGIN`) to trusted frontend URL.
- Use strong secrets for `JWT_SECRET` and `BACKUP_PASSWORD`.
- Store backups and logs securely.
