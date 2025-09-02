# MarketPlace Manager

A full-stack app to manage marketplace listings with analytics for Facebook Marketplace and Kijiji.

## Tech Stack

- Client: React + Vite, MUI 7
- Server: Node + Express + Mongoose
- Scraping: Puppeteer (opt-in)

## Monorepo Layout

- `marketplace-manager/client/` – React front-end
- `marketplace-manager/server/` – Express API and services

## Getting Started

### Prerequisites
- Node.js 18+ (recommended Node 20)
- npm 9+

### Environment
Create `marketplace-manager/server/.env` with at least:
```
MONGODB_URI=mongodb://localhost:27017/marketplace_manager
JWT_SECRET=change_me
PORT=5000
```

Optional client env: `marketplace-manager/client/.env` (only if you have client-side vars)

### Install
```bash
# From repo root
npm --prefix marketplace-manager/client install
npm --prefix marketplace-manager/server install
```

### Run
- Client dev server (Vite):
```bash
npm --prefix marketplace-manager/client run dev
```
- Server (nodemon):
```bash
npm --prefix marketplace-manager/server run dev
```

You can run them in two terminals. A helper script exists:
```bash
./marketplace-manager/restart-servers.sh
```

### Build
```bash
npm --prefix marketplace-manager/client run build
```

## Scripts
- Client
  - `npm run dev` – start Vite dev server
  - `npm run build` – production build
  - `npm run lint` – ESLint
- Server
  - `npm run dev` – start with nodemon
  - `npm start` – start server

## CI
GitHub Actions workflow runs lint and build for the client and installs server deps. See `.github/workflows/ci.yml`.

## Notes
- Scraping automations may be restricted by platform terms—use responsibly.
- Do not commit secrets; `.gitignore` excludes common env files.
