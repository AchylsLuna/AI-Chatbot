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
- Data layer: MongoDB for non-sensitive operational data

## Development Roadmap

### Sprint 1: AI and Core Logic

- Build the NLP-driven chatbot for department routing
- Create the appointment schema in MongoDB
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
- Web Platform: React, TypeScript, Tailwind CSS, Node.js, Express.js, REST API, MongoDB
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

## Local API (RBAC + MongoDB + Blockchain)

The demo API uses MongoDB, JWT-based RBAC, and an optional Ethereum contract call for booked appointments.

### Required services

- MongoDB running locally (`mongodb://127.0.0.1:27017`)

### Environment variables (server)

```
PORT=5174
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=pulse-ledger
JWT_SECRET=change-me
JWT_EXPIRES_IN=12h
CORS_ORIGIN=http://localhost:5173
ADMIN_USER=admin
ADMIN_PASS=admin123
NURSE_USER=nurse
NURSE_PASS=nurse123
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

The API seeds `ADMIN_USER` and `NURSE_USER` on startup. Update these in the environment for real deployments.
