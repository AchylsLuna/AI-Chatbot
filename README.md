# AI Healthcare Triage Chatbot

A reservation-based outpatient triage concept that separates AI guidance from human confirmation. The chatbot provides advice-only guidance and routes users into a nurse-reviewed reservation flow.

## Product Overview

The system prioritizes clear separation between intelligent triage and administrative confirmation.

### User Flow

- Advice-only interaction: guided inquiry to reduce self-diagnosis errors
- Reservation model: users request a time slot; no appointment is finalized yet
- Nurse/admin intervention: dashboard review of the AI triage summary with Accept or Decline
- Status tracking: real-time status for the user (Pending -> Approved or Declined)

## System Architecture (Layered)

- Presentation layer (Frontend): React web UI for registration and guided chat
- Application layer (Business Logic): Node.js + Python services orchestrating data flow
- AI processing layer: NLP-based symptom routing to the correct department
- Blockchain layer (CODEX integration): Ethereum smart contracts for accepted appointments
- Data layer: MongoDB for non-sensitive operational data

## Development Roadmap

### Sprint 1: AI and Core Logic

- Build the NLP-driven chatbot for department routing
- Create the Reservation schema in MongoDB
- Implement the nurse/admin review dashboard

### Sprint 2: Blockchain and Security

- Deploy smart contracts to log finalized appointments
- Add cryptographic hashing for patient records and transaction history
- Test recommendation accuracy and data immutability

## Technical Constraints

- AI limit: guidance is based on doctor-approved guidelines and is not a diagnosis
- Security: salted password hashing and RBAC with least privilege
- Availability: outpatient triage only; assumes stable internet for real-time updates

## Tech Stack (3 Platforms)

- AI Platform: NLP triage engine, advice-only guidance logic
- Web Platform: React, TypeScript, Tailwind CSS, Node.js, Express.js, REST API, MongoDB
- Blockchain Platform: Ethereum smart contracts for immutable appointment records

## Scripts

- npm install
- npm run dev
- npm run dev:api
- npm run build
- npm run preview

## Local API (RBAC + MongoDB + Blockchain)

The demo API uses MongoDB, JWT-based RBAC, and an optional Ethereum contract call for accepted reservations.

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
CONTRACT_FUNCTION=recordAppointment
CONTRACT_ABI=
```

If the Ethereum variables are not provided, blockchain writes are marked as skipped and a local hash is stored.

### Demo RBAC credentials

The API seeds `ADMIN_USER` and `NURSE_USER` on startup. Update these in the environment for real deployments.
