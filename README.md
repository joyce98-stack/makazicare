# Makazi Care

Makazi Care is a small property and tenant management application. The Express server serves the HTML frontend and JSON API from the same origin. The default data store is a local JSON file in `backend/data.json`.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install` in this folder.
3. Copy `.env.example` to `.env` and set `JWT_SECRET` to a long random value. You can change `DEMO_PASSWORD` to set the shared password for the seeded demo accounts.
4. Run `npm start` and open `http://localhost:3001`.

The first start creates demo data and hashes the demo password. Seeded accounts are:

| Role | Email |
| --- | --- |
| Landlord | `rosamay@gmail.com` |
| Property manager | `mira.cruz@gmail.com` |
| Tenant | `john.doe@example.com` |

All demo accounts use the password in `DEMO_PASSWORD` (defaults to `DemoPass123!` in development).

Landlords can also register from the sign-in page. Registration creates a landlord account only; managers and tenants are added from the landlord portal using one-time account setup links.

The API health endpoint is `GET /api/health`. Authentication uses a signed, HTTP-only session cookie. New tenant and manager records produce one-time acceptance links that staff can share. Email delivery is not configured. The app records payments manually; it does not charge tenants online.

## Production notes

Set `NODE_ENV=production` and `JWT_SECRET`, and provision a real data file before starting. The server refuses to seed demo accounts in production. Use HTTPS and back up the JSON database. The JSON store is intended for a single server instance and a small demo; use a database such as PostgreSQL for concurrent or production workloads. Configure allowed frontend origins in `CORS_ORIGIN` if the frontend is hosted separately.
