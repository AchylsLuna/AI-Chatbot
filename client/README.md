# AI Health Care

A direct-booking outpatient triage concept that pairs AI guidance with immutable blockchain logging. The chatbot provides advice-only guidance, recommends a department, and books an appointment with a hash-only on-chain audit trail.

## Product Overview

The system prioritizes guidance-first booking with immutable auditability.

### User Flow

- Advice-only interaction: guided inquiry to reduce self-diagnosis errors
- AI department recommendation with explicit non-diagnosis disclaimer
- Direct booking: appointment is created immediately after recommendation
- Blockchain logging: hash-only record written on-chain
- Status tracking: real-time status for the user (Booked -> Recorded or Failed)

## System Architecture (Layered)

- Presentation layer (Frontend): React web UI for registration and guided chat
- Application layer (Business Logic): Node.js services orchestrating data flow
- AI processing layer: NLP-based symptom routing to the correct department
- Blockchain layer (CODEX integration): Ethereum smart contracts for hashed appointment records
- Data layer: in-memory storage for local runtime data

## Development Roadmap

### Sprint 1: AI and Core Logic

- Build the NLP-driven chatbot for department routing
- Create the appointment schema in backend storage
- Implement the operations monitoring dashboard

### Sprint 2: Blockchain and Security

- Deploy smart contracts to log appointment hashes
- Add cryptographic hashing for patient records and transaction history
- Test recommendation accuracy and data immutability

## Technical Constraints

- AI limit: guidance is based on doctor-approved guidelines and is not a diagnosis
- Security: salted password hashing and RBAC with least privilege
- Availability: outpatient triage only; assumes stable internet for real-time updates

## Tech Stack (3 Platforms)

- AI Platform: NLP triage engine, advice-only guidance logic
- Web Platform: React, TypeScript, Tailwind CSS, Node.js, Express.js, REST API
- Blockchain Platform: Ethereum smart contracts for immutable appointment hashes

## Scripts

Client (from the client folder):

- npm install
- npm run dev
- npm run build
- npm run preview

Server (from the server folder):

- npm install
- npm run dev

## Local API (RBAC + In-Memory Storage + Blockchain)

The demo API uses in-memory storage, JWT-based RBAC, and an optional Ethereum contract call for booked appointments.

### Required services

- No database service required. The backend runs with in-memory storage.

### Environment variables (server)

```
PORT=5174
JWT_SECRET=change-me
JWT_EXPIRES_IN=12h
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_SECRET=change-me-otp
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
SEED_USERS=true
SEED_DEMO=true
ADMIN_USER=admin@aihealthcare.com
ADMIN_PASS=admin123
NURSE_USER=nurse@aihealthcare.com
NURSE_PASS=nurse123
SYSADMIN_USER=sysadmin@aihealthcare.com
SYSADMIN_PASS=sysadmin123
USER_USER=user@aihealthcare.com
USER_PASS=user123
WEB3_RPC_URL=
CONTRACT_ADDRESS=
CONTRACT_PRIVATE_KEY=
CONTRACT_FUNCTION=recordAppointmentHash
CONTRACT_ABI=
CHAIN_STRICT=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_MS=4500
```

Create these values in server/.env (copy from server/.env.example).

If the Ethereum variables are not provided, blockchain writes are marked as skipped and the appointment is still stored locally with a hash entry.
If `CHAIN_STRICT=true`, bookings will fail unless the blockchain write confirms.

### Local blockchain

Set environment variables for your existing blockchain node and deployed contract:

```
WEB3_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
CONTRACT_PRIVATE_KEY=0x...
```

### Demo RBAC credentials

The API seeds accounts on startup (`SEED_USERS=true`):

- User: `user@aihealthcare.com` / `user123`
- Nurse: `nurse@aihealthcare.com` / `nurse123`
- Admin: `admin@aihealthcare.com` / `admin123`
- System Admin: `sysadmin@aihealthcare.com` / `sysadmin123`

Access paths:

- User side: sign in at `/login` (User defaults to triage view after login)
- Admin side: sign in at `/admin-login`, then continue to Admin Dashboard
