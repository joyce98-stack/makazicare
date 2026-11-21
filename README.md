# Makazi Care

Makazi Care is a small property and tenant management application. The Express server serves the HTML frontend and JSON API from the same origin. The default data store is a local JSON file in `backend/data.json`.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install` in this folder.
3. Copy `.env.example` to `.env`, set a long random `JWT_SECRET`, and replace the `ADMIN_PASSWORD` placeholder with a unique password of at least 16 characters. You can change `DEMO_PASSWORD` to set the shared password if you enable sample demo data.
4. Run `npm start` and open `http://localhost:3001`.

The first start creates an empty property database and the system admin. New landlord accounts also start with an empty portfolio and must add their own properties. Set `SEED_DEMO_DATA=true` to load sample demo landlords, properties, tenants, and accounts.

When demo data is enabled, seeded accounts are:

| Role | Email |
| --- | --- |
| Landlord | `rosamay@gmail.com` |
| Property manager | `mira.cruz@gmail.com` |
| Tenant | `john.doe@example.com` |

All demo accounts use the password in `DEMO_PASSWORD` (defaults to `DemoPass123!` in development).

Landlords can also register from the sign-in page. Registration creates a landlord account only; managers and tenants are added from the landlord portal using one-time account setup links.

The read-only system admin is seeded from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first startup. The admin can review landlord accounts, owned properties, tenant counts, and manager counts. Set a unique password of at least 16 characters in `.env` before starting with a fresh data file.

The API health endpoint is `GET /api/health`. Authentication uses a signed, HTTP-only session cookie. New tenant and manager records produce one-time acceptance links that staff can share. Email delivery is not configured. The app does not initiate rent payments; tenants pay through their landlord's PayBill or bank account.

Landlords can configure their own PayBill and bank display details under **Payment setup**. Tenants receive a unique PayBill account reference. The Daraja-ready C2B callbacks match incoming transactions to the oldest outstanding rent charges, deduplicate by transaction ID, and keep unmatched or excess payments for reconciliation. To receive live callbacks, each landlord needs Daraja access and the API must be deployed to a public HTTPS origin set in `PUBLIC_API_ORIGIN`; the landlord then registers the confirmation and validation URLs in Daraja. Bank details are display-only until the landlord has access to a bank notification API such as KCB BUNI.

## Production notes

Set `NODE_ENV=production` and `JWT_SECRET`, and provision a real data file before starting. The server refuses to seed demo accounts in production. Use HTTPS and back up the JSON database. The JSON store is intended for a single server instance and a small demo; use a database such as PostgreSQL for concurrent or production workloads. Configure allowed frontend origins in `CORS_ORIGIN` if the frontend is hosted separately.
