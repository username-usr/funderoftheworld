# FundersOfTheWorld — Charity Management Webapp

Comprehensive charity / fundraising management application (backend + frontend).

## Table of Contents
- Project Overview
- Why this project exists
- Features
- Tech Stack
- Architecture & Folder Structure
- Prerequisites
- Environment & Configuration
- Database notes
- Run locally (development)
- Build & Deploy (production)
- API Reference (selected endpoints)
- Authentication
- Troubleshooting
- Contributing
- License & Contact

## Project Overview

- **What:** A full-stack web application to manage charities, campaigns, projects and donations. It provides authentication for Staff and Donor users, campaign and project management (staff), donation recording (donors), and receipt generation.
- **Who:** Intended for small/medium NGOs and developers building donor management tools.

## Why
- Centralize campaign and project financials, donor records, and receipts.
- Provide a lightweight, extensible base for NGO operations and reporting.

## Features
- User registration and login (Staff / Donor)
- JWT-based authentication and role-based authorization
- Campaign CRUD and summaries (staff)
- Project CRUD, expense tracking and budget enforcement (staff)
- Donation recording, history, and receipt endpoints
- Oracle Database-backed persistence (node-oracledb)
- React + Vite frontend for dashboards and receipt printing

## Tech Stack
- Backend: Node.js, Express, node-oracledb, bcrypt, jsonwebtoken
- Frontend: React, Vite, React Router
- Database: Oracle (XE or Enterprise) — app expects an Oracle connection

## Architecture & Folder Structure
Root layout (important files/folders):
- `backend/` — Express server, DB config, API routes
  - `index.js` — main server file (contains routes and middleware)
  - `dbConfig.js` — DB connection configuration
  - `package.json` — backend scripts & deps
- `frontend/` — React app built with Vite
  - `src/` — React components, pages, context
  - `package.json` — frontend scripts & deps

## Prerequisites
- Node.js (recommended v18+)
- NPM or Yarn
- Oracle Database accessible to the backend (can be local XE or remote)
- Oracle Instant Client if using Thick mode (index.js attempts to initOracleClient())

## Environment & Configuration
Backend currently reads its connection settings from `backend/dbConfig.js`. The file contains a JS object with `user`, `password` and `connectString` (example: `localhost:1521/XE`).

Recommended (safer) approach: use environment variables and change `dbConfig.js` to load them. Example `.env` values:

```
ORACLE_USER=THECHARITY
ORACLE_PASSWORD=super-secure-password
ORACLE_CONNECT_STRING=localhost:1521/XE
JWT_SECRET=replace_with_a_secure_random_string
PORT=3000
FRONTEND_URL=http://localhost:5173
```

Minimal `dbConfig.js` example (switch to env vars):

```javascript
module.exports = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING
};
```

Notes:
- `index.js` currently uses a hard-coded `JWT_SECRET` and `PORT` — replace these with environment variables for production.
- The Express CORS config expects the frontend at `http://localhost:5173` by default.

## Database notes
- This project expects the following logical tables (examples referenced in `index.js`): `NEW_CREDENTIALS`, `STAFF`, `DONOR`, `CAMPAIGN`, `DONATION`, `PROJECT` and supporting sequences (e.g. `DONATION_SEQ`).
- The sample code uses Oracle functions like `TO_DATE` and sequences — adapt SQL if you switch DB vendors.
- No migration scripts are provided in this repository. To get started, create the schemas/tables the server expects or adapt SQL to your existing schema.

Example minimal `NEW_CREDENTIALS` table (Oracle SQL):
```sql
CREATE TABLE NEW_CREDENTIALS (
  USER_ID VARCHAR2(100) PRIMARY KEY,
  AADHAR_NO VARCHAR2(12) UNIQUE,
  PASSWORD VARCHAR2(200),
  EMAIL VARCHAR2(255) UNIQUE,
  USER_TYPE VARCHAR2(10)
);
-- create other tables (DONOR, STAFF, CAMPAIGN, DONATION, PROJECT) per the queries used in `index.js`
```

## Run locally (development)
1. Backend

```bash
cd backend
npm install
# Configure your DB credentials in backend/dbConfig.js or via env vars
npm run start
```

The backend runs with `nodemon index.js` by default and listens on `PORT` 3000 unless you change it.

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend uses Vite and will by default run at `http://localhost:5173`.

When both are running, the frontend will call the backend APIs (CORS origin is configured in `index.js`).

## Build & Deploy (production)
- Frontend: `cd frontend && npm run build` — this produces a `dist/` folder you can host on any static host or integrate into the backend static serving.
- Backend: set `NODE_ENV=production`, ensure env vars are set, and run `node index.js` (or use a process manager like `pm2`).

## API Reference (selected endpoints)
All JSON requests/responses unless noted.

- POST `/api/auth/signup` — Register a new user (body: `{ aadharNo, email, password, userType, fname?, lname? }`)
- POST `/api/auth/login` — Login (body: `{ email, password }`) — returns `{ token, userType, primaryId }`
- GET `/api/profile` — Protected; returns user payload. Header: `Authorization: Bearer <token>`

- Campaigns (Staff)
  - GET `/api/campaigns` — list all campaigns (staff only)
  - GET `/api/campaigns/active` — list active campaigns
  - POST `/api/campaigns` — create campaign (staff)
  - PATCH `/api/campaigns/:campId/status` — update status (staff)
  - GET `/api/campaigns/summary` — totals per campaign

- Donations
  - POST `/api/donations` — create donation (donor)
  - GET `/api/donations/history` — donation history (donor or staff view)
  - GET `/api/donations/:donId` — get a specific donation / receipt

- Projects (Staff)
  - GET `/api/projects` — list projects
  - POST `/api/projects` — create project
  - PATCH `/api/projects/:projId/expense` — add expense (enforces budget)
  - PATCH `/api/projects/:projId/link-campaign` — link project to campaign

This is not an exhaustive list — see `backend/index.js` for full route implementations and expected payloads.

## Authentication
- Endpoints that require a user: include header `Authorization: Bearer <JWT_TOKEN>` returned from `/api/auth/login`.
- Tokens expire after 1 hour (by default in `index.js`).

## Troubleshooting
- Oracle Client init failure: `oracledb.initOracleClient()` may require Oracle Instant Client (OS package) and proper `LD_LIBRARY_PATH` or `OCI_LIB_DIR`.
- DB connection errors: ensure `dbConfig.js` contains correct credentials and `connectString` (host:port/SERVICE).
- CORS: If frontend cannot reach backend, confirm the URL in `index.js` CORS origin matches frontend `dev` URL.

## Contributing
- Fork the repo, create a branch, and open a PR.
- Suggested improvements: add migrations (SQL), switch `dbConfig.js` to use `.env`, add unit/integration tests, and add CI workflows to validate.

## License & Contact
- This project does not include a license file by default. Add a license (MIT, Apache-2.0, etc.) as needed.
- Questions or feature requests: open an issue in the repository or contact the maintainer.
