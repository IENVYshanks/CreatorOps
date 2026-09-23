# CreatorPilot

A modular TypeScript monorepo for creator operations. The Next.js frontend, Express API, and shared transport contracts are independently owned npm workspaces with one lockfile.

## Repository boundaries

```text
apps/
  frontend/             Next.js presentation and browser interaction
  backend/              Express API and domain modules
    src/modules/
      identity/
        authentication/ registration, login, logout, and access checks
        passwords/      password hashing implementation
        sessions/       secure session tokens and cookies
        profiles/       authenticated user profiles
        users/          user lookup interface for other modules
        database/       identity schemas and PostgreSQL repositories
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

## Authentication, profile, and workspace API

| Method   | Path                                       | Purpose                                     |
| -------- | ------------------------------------------ | ------------------------------------------- |
| `POST`   | `/auth/register`                           | Register and create a cookie session        |
| `POST`   | `/auth/login`                              | Authenticate and create a new session       |
| `POST`   | `/auth/logout`                             | Revoke the current session                  |
| `GET`    | `/auth/session`                            | Return the authenticated user               |
| `GET`    | `/profile`                                 | Return the authenticated user's profile     |
| `POST`   | `/workspaces`                              | Create a workspace with the caller as owner |
| `GET`    | `/workspaces`                              | List only the caller's workspaces           |
| `GET`    | `/workspaces/:workspaceId`                 | Return a member-scoped workspace            |
| `GET`    | `/workspaces/:workspaceId/members`         | List workspace members                      |
| `POST`   | `/workspaces/:workspaceId/members`         | Add an existing user (owner only)           |
| `DELETE` | `/workspaces/:workspaceId/members/:userId` | Remove a member (owner only)                |
| `GET`    | `/health`                                  | Report API health                           |

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
