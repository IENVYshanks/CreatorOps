# CreatorPilot

A modular TypeScript monorepo for creator operations. The Next.js frontend, Express API, and shared transport contracts are independently owned npm workspaces with one lockfile.

## Repository boundaries

```text
apps/
  frontend/             Next.js presentation and browser interaction
  backend/              Express API and domain modules
    src/modules/
      identity/         users, passwords, and revocable sessions
      workspaces/       workspace ownership and tenant membership
packages/
  contracts/            shared Zod HTTP schemas; no persistence types
infra/
  compose/              local PostgreSQL
```

Modules expose application interfaces and keep database adapters private. The frontend communicates through versioned HTTP contracts and never imports backend repositories or Drizzle models.

## Requirements

- Node.js 24 (the exact version is recorded in `.nvmrc`)
- npm
- Docker for local PostgreSQL and integration tests

## Local setup

After configuring the values in `apps/backend/.env.example`:

```sh
npm install
npm run infra:up
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. The frontend proxies `/api/*` to the backend at `http://localhost:3001`.

Database migrations are explicit release operations; API and frontend startup never run migrations automatically.

## Applications

- `npm run dev --workspace=@creatorpilot/frontend` starts the frontend.
- `npm run dev --workspace=@creatorpilot/backend` starts the backend.
- `npm run build` creates all production builds.
- `npm start` starts both production applications after a successful build.

## Authentication and workspace API

| Method | Path             | Purpose                                     |
| ------ | ---------------- | ------------------------------------------- |
| `POST` | `/auth/register` | Register and create a cookie session        |
| `POST` | `/auth/login`    | Authenticate and create a new session       |
| `POST` | `/auth/logout`   | Revoke the current session                  |
| `GET`  | `/auth/session`  | Return the authenticated user               |
| `POST` | `/workspaces`    | Create a workspace with the caller as owner |
| `GET`  | `/workspaces`    | List only the caller's workspaces           |
| `GET`  | `/health`        | Report API health                           |

Passwords use Argon2id. Only a SHA-256 digest of each random session token is stored. Browser sessions use `HttpOnly`, `SameSite=Strict` cookies and `Secure` cookies in production. Unsafe production requests must come from `APP_ORIGIN`.

## Configuration

Backend settings are documented in `apps/backend/.env.example`. Frontend proxy settings are documented in `apps/frontend/.env.local.example`.

## Validation

Self-contained checks do not require external services:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Run the PostgreSQL integration suite only after configuring the external environment and starting Docker:

```sh
npm run test:integration
```
