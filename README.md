# Creator Operations Platform

An npm-workspaces starter with a Next.js frontend and an Express backend, both written in strict TypeScript.

## Applications

- `apps/frontend` owns presentation and browser interaction. It runs on `http://localhost:3000`.
- `apps/backend` owns API and server logic. It runs on `http://localhost:3001`.

The frontend forwards `/api/*` requests to the backend, so browser code does not depend on a backend origin or CORS configuration.

## Requirements

- Node.js 24 (the exact development version is recorded in `.nvmrc`)
- npm

## Start both applications

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. The page checks the Express health endpoint through `http://localhost:3000/api/health`.

## Start an application independently

```sh
npm run dev --workspace=@creator-ops/backend
npm run dev --workspace=@creator-ops/frontend
```

Copy `apps/backend/.env.example` to `apps/backend/.env` for backend overrides. Copy `apps/frontend/.env.local.example` to `apps/frontend/.env.local` when the backend runs at a different address.

## Root commands

- `npm run dev` starts both applications in development mode.
- `npm run build` creates both production builds.
- `npm start` starts both production builds.
- `npm run typecheck` checks both TypeScript projects.
- `npm test` runs workspace test suites.
- `npm run lint` checks all application source.
- `npm run format:check` checks formatting.

## Backend API

### `GET /health`

Returns HTTP `200` with:

```json
{
  "status": "ok"
}
```
