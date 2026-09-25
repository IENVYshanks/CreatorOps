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
      connections/
        instagram/
          routes/       HTTP endpoints and callback handling
          services/     authorization and connection use cases
          providers/    provider contract plus Meta and mock adapters
          repositories/ persistence contract and PostgreSQL adapter
          database/     Instagram connection database schema
          security/     access-token encryption
      content/
        routes/         member-scoped content draft HTTP endpoints
        services/       content workflow and validation rules
        repositories/   persistence contract and PostgreSQL adapter
        database/       content item and platform variant schemas
      workspaces/       workspace ownership and tenant membership
    tests/               backend tests grouped by module
  frontend/tests/        frontend component tests
packages/
  contracts/            shared Zod HTTP schemas; no persistence types
    tests/               shared contract tests
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

## API

| Method   | Path                                          | Purpose                                      |
| -------- | --------------------------------------------- | -------------------------------------------- |
| `POST`   | `/auth/register`                              | Register and create a cookie session         |
| `POST`   | `/auth/login`                                 | Authenticate and create a new session        |
| `POST`   | `/auth/logout`                                | Revoke the current session                   |
| `GET`    | `/auth/session`                               | Return the authenticated user                |
| `GET`    | `/profile`                                    | Return the authenticated user's profile      |
| `POST`   | `/workspaces`                                 | Create a workspace with the caller as owner  |
| `GET`    | `/workspaces`                                 | List only the caller's workspaces            |
| `GET`    | `/workspaces/:workspaceId`                    | Return a member-scoped workspace             |
| `GET`    | `/workspaces/:workspaceId/members`            | List workspace members                       |
| `POST`   | `/workspaces/:workspaceId/members`            | Add an existing user (owner only)            |
| `DELETE` | `/workspaces/:workspaceId/members/:userId`    | Remove a member (owner only)                 |
| `GET`    | `/workspaces/:workspaceId/content`            | List workspace content drafts                |
| `POST`   | `/workspaces/:workspaceId/content`            | Create a content draft and Instagram variant |
| `GET`    | `/workspaces/:workspaceId/content/:contentId` | Return a workspace content draft             |
| `PATCH`  | `/workspaces/:workspaceId/content/:contentId` | Update content, variant, or workflow status  |
| `DELETE` | `/workspaces/:workspaceId/content/:contentId` | Delete a workspace content draft             |
| `GET`    | `/health`                                     | Report API health                            |

Passwords use Argon2id. Only a SHA-256 digest of each random session token is stored. Browser sessions use `HttpOnly`, `SameSite=Strict` cookies and `Secure` cookies in production. Unsafe production requests must come from `APP_ORIGIN`.

## Configuration

Backend settings are documented in `apps/backend/.env.example`. Frontend proxy settings are documented in `apps/frontend/.env.local.example`.

For local development without Meta credentials, set
`INSTAGRAM_PROVIDER=mock` in `apps/backend/.env`. The mock provider completes
the same browser redirect and encrypted connection-storage flow without making
an external request. Mock mode is rejected when `NODE_ENV=production`; use
`INSTAGRAM_PROVIDER=meta` with the documented Meta credentials in production.

When `INSTAGRAM_PROVIDER=meta`, `npm run dev` also starts an ngrok tunnel for
the HTTPS origin in `INSTAGRAM_REDIRECT_URI`. That origin must be assigned to
the authenticated ngrok account, and the full callback URI must exactly match
the redirect URI saved in Meta. Set `NGROK_BIN` when the `ngrok` executable is
not available on `PATH`. The tunnel exposes the local frontend on port 3000 to
the internet until the development command is stopped.

After creating a workspace, open its content studio at
`/workspaces/<workspace-id>/content`. It supports creating and editing drafts,
previewing the Instagram variant, and moving content through draft, ready, and
published states.

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
