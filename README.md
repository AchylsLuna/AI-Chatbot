# Hospital AI & Blockchain Server

A secure backend system for managing patient data, appointments, and medical records using Node.js, Express, and MongoDB.

## Features
- **Authentication:** Secure Login, MFA (Email OTP), and Session Management.
- **Security:** Rate limiting, Helmet headers, Data sanitization (NoSQL/XSS).
- **Role-Based Access:** Granular permissions for Admins, Doctors, and Patients.
- **Audit Logging:** Tracks all sensitive actions.

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas (Mongoose)
- **Auth:** JWT (Stateful Sessions), Bcrypt, Nodemailer

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas Connection String

### Installation
```bash
git clone [https://github.com/yourusername/hospital-app.git](https://github.com/yourusername/hospital-app.git)
cd server
npm install