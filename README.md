# Customer Intelligence MVP

A simple customer analytics and CRM dashboard built for small businesses.

## Features
- Customer profile management
- Order entry flow with phone/email matching
- Automatic metrics: total orders, total spent, first/last purchase, LTV, AOV, status
- Dashboard summary cards and customer table
- Customer detail page with order history

## Tech stack
- Frontend: React + Vite + Bootstrap
- Backend: Express + SQLite

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. Open the frontend at `http://localhost:5174`

## Notes
- The development frontend runs on port `5174`.
- The server runs on port `4000`.
- The database is stored locally at `db/crm.sqlite`.
- The app seeds sample customers and orders on first launch.
- Order creation uses phone/email matching and creates customers if needed.

## Future extensions
- Add CSV import, webhooks, and marketplace integrations
- Add richer search, filter, and pagination
- Add authentication and multi-user support

## Current features
- Dashboard search and status/source filtering
- Export filtered customer list as CSV
