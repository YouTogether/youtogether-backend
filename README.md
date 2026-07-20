# youtogether-backend

NestJS API server for the YouTogether platform - a synchronized watch party application enabling groups of users to watch YouTube videos together in real time.

This repository contains the backend application only. 
The Flutter frontend is maintained in [`youtogether-frontend`](https://github.com/YouTogether/youtogether-frontend). 
Project management artifacts and planning documents are maintained in [`youtogether-project`](https://github.com/YouTogether/youtogether-project).

---

## Table of Contents

- [Architecture](#architecture)
- [Bounded Contexts](#bounded-contexts)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Git Hooks](#git-hooks)
- [Running Tests](#running-tests)
- [CI Pipeline](#ci-pipeline)
- [Release Process](#release-process)
- [Contributing — Issue Creation](#contributing--issue-creation)
- [Labels Reference](#labels-reference)

---

## Architecture

The application is a **NestJS** REST API backed by **PostgreSQL** and **Firebase Realtime Database**. It follows a modular architecture aligned with the DDD bounded contexts:

```
src/
  common/                      # Guards, decorators, interceptors, filters
  config/                      # Configuration modules (database, JWT, Firebase)
  modules/
    auth/                      # Authentication — registration, login, JWT lifecycle
      domain/                  # Entities, repository interfaces, service interfaces
      infrastructure/          # TypeORM repositories, external service adapters
      application/             # Use cases / service implementations
      presentation/            # Controllers, DTOs, validators
    room/                      # Room management
    video-sync/                # Video synchronisation events
```

All implementations follow **Test-Driven Development** (tests written before production code) and **Domain-Driven Design** (code organised around bounded contexts).

---

## Bounded Contexts

| Context                   | Scope                                                                                |
|---------------------------|--------------------------------------------------------------------------------------|
| **Authentication**        | Account registration, login, password hashing, JWT issuance and refresh, logout      |
| **Room**                  | Room creation, listing, membership, ownership enforcement, CRUD operations           |
| **Video Synchronisation** | Playback event forwarding, Firebase Realtime Database integration, presence tracking |

---

## Prerequisites
| Tool       | Version              | Notes                                                                                          |
|------------|----------------------|------------------------------------------------------------------------------------------------|
| Node.js    | 22.20.0 LTS          | [Installation guide](https://nodejs.org/)                                                      |
| npm        | Bundled with Node.js | —                                                                                              |
| PostgreSQL | 16.x                 | Installed and running natively (see below). No containerization is used for local development. |
| lefthook   | Latest               | Git hooks manager — see [Git Hooks](#git-hooks)                                                |

> **Note:** this project does not currently provide a Docker setup. PostgreSQL must be installed
> natively on your machine, and the API runs locally via `npm run start:dev`. Containerization is
> not implemented at this stage.

Install PostgreSQL 16.x natively for your OS ([official downloads](https://www.postgresql.org/download/)),
then create the database referenced by your `.env` (`DB_DATABASE`, default `youtogether`).

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu / Debian
sudo apt install postgresql-16
sudo systemctl start postgresql

# Windows
# Use the official installer: https://www.postgresql.org/download/windows/
```

Then create the local database and user matching your `.env`:

```bash
psql postgres -c "CREATE USER youtogether WITH PASSWORD 'youtogether_dev';"
psql postgres -c "CREATE DATABASE youtogether OWNER youtogether;"
```

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/youtogether-org/youtogether-backend.git
cd youtogether-backend

# Install dependencies
npm install

# Install git hooks
lefthook install

# Copy the environment template and fill in the required values
cp .env.example .env

# Run database migrations
npm run migration:run

# Start the development server (watch mode)
npm run start:dev
```

The API will be available at `http://localhost:3000/api/v1` by default (URI-based versioning).
Interactive Swagger documentation is served, unversioned, at `http://localhost:3000/api-docs`.

---

## Environment Variables

All environment variables are defined in `.env`. 
Copy `.env.example` as a starting point. 
The `.env` file is listed in `.gitignore` and must never be committed.

| Variable                 | Description                          |
|--------------------------|--------------------------------------|
| `DATABASE_URL`           | PostgreSQL connection string         |
| `JWT_SECRET`             | Secret used to sign access tokens    |
| `JWT_REFRESH_SECRET`     | Secret used to sign refresh tokens   |
| `JWT_EXPIRATION`         | Access token expiration (e.g. `15m`) |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiration (e.g. `7d`) |
| `FIREBASE_PROJECT_ID`    | Firebase project identifier          |
| `FIREBASE_CLIENT_EMAIL`  | Firebase service account email       |
| `FIREBASE_PRIVATE_KEY`   | Firebase service account private key |
| `PORT`                   | HTTP port (default: `3000`)          |
| `CORS_ORIGIN`            | Allowed origins for CORS request     |

---


## API Documentation

The full REST API contract (Authentication and Room bounded contexts) is described via an
OpenAPI 3.0 document, generated directly from the DTOs and controllers using
[`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction). This guarantees the
documentation cannot drift from the actual implementation.

Once the development server is running (`npm run start:dev`), the interactive Swagger UI
is available at:

---

## Git Hooks

This repository uses [lefthook](https://github.com/evilmartians/lefthook) to manage git hooks. 
lefthook is preferred over husky for consistency with the frontend repository, which uses the Flutter toolchain without Node.js.

### Installation

```bash
# macOS
brew install lefthook

# Linux / Windows (via Go)
go install github.com/evilmartians/lefthook@latest
```

After installing lefthook, activate the hooks in your local clone:

```bash
lefthook install
```

This command must be run once after each fresh clone. It is not automatic.

### Active Hooks

| Hook         | Trigger      | Behavior                                                                   |
|--------------|--------------|-----------------------------------------------------------------------------|
| `commit-msg` | Every commit | Validates the commit message against the Conventional Commits specification |
| `pre-commit` | Every commit | Runs ESLint on staged `.ts` and `.js` files only                            |
| `pre-push`   | Every push   | Validates the branch name against the project naming convention             |

### Commit Message Convention

All commit messages must follow the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`

**Allowed scopes:** `auth`, `room`, `video-sync`, `api`, `db`, `infra`, `config`

**Examples:**

```
feat(auth): implement POST /auth/register endpoint
fix(room): correct foreign key constraint on room deletion
test(auth): write unit tests for AuthService.login
refactor(db): extract database connection factory
chore(infra): upgrade NestJS to v11
ci(infra): add end-to-end test job to workflow
```

A commit message that does not match this format is rejected locally by the `commit-msg` hook and will also be flagged by the CI pipeline.

### Branch Naming Convention

```
<type>/<bounded-context>/<short-description-in-kebab-case>
```

**Allowed types:** `feature`, `fix`, `hotfix`, `refactor`, `test`, `docs`, `chore`, `ci`, `release`

**Examples:**

```
feature/auth/register-endpoint
feature/room/create-room-dto-validation
fix/auth/refresh-token-rotation
test/auth/auth-service-unit-tests
chore/db/add-room-index-migration
```

A push from a branch that does not match this pattern is rejected by the `pre-push` hook.

To bypass a hook in exceptional circumstances (not recommended):

```bash
git push --no-verify
```

---

## Running Tests

```bash
# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run unit tests with coverage
npm run test:cov

# Run end-to-end tests (requires a running PostgreSQL instance)
npm run test:e2e
```

End-to-end tests use a dedicated test database. 
Ensure `DATABASE_URL` in your `.env` points to a test database before running `test:e2e`, or set the variable inline:

```bash
DATABASE_URL=postgresql://youtogether:youtogether_dev@localhost:5432/youtogether_test npm run test:e2e
```

Tests are written before production code following the TDD red-green-refactor cycle. 
Unit test files are co-located with the source files they test under the `*.spec.ts` naming convention. 
End-to-end test files are located in the `test/` directory at the project root.

---

## CI Pipeline

The CI pipeline runs on every push to `main` and on every pull request targeting `main`. 
It is defined in `.github/workflows/ci.yml`.

| Job         | Description                                             | Blocks merge |
|-------------|---------------------------------------------------------|--------------|
| `lint`      | ESLint + TypeScript compilation check                   | Yes          |
| `test-unit` | Jest unit tests with coverage artefact                  | Yes          |
| `test-e2e`  | End-to-end tests against a PostgreSQL service container | Yes          |
| `build`     | Production bundle compilation (main branch only)        | No           |

All jobs in the `lint`, `test-unit`, and `test-e2e` stages must pass before a pull request is eligible for merge. 
This is enforced by the branch protection ruleset on `main`.

---

## Release Process

Releases are managed automatically by [release-please](https://github.com/googleapis/release-please), configured in `.github/workflows/release-please.yml`.

**How it works:**

1. Every merge to `main` triggers the release-please workflow.
2. release-please inspects all commits since the last release and computes the next semantic version based on Conventional Commit types (`feat` → MINOR, `fix`/`refactor`/`perf` → PATCH, `BREAKING CHANGE` → MAJOR).
3. It creates or updates a **Release PR** that accumulates the changelog and version bump in `package.json`.
4. When you are ready to publish a release, merge the Release PR.
5. release-please creates a GitHub Release, a Git tag (`vX.Y.Z`), and updates `CHANGELOG.md`.

No tag is created on a direct push to `main`. The release moment is always explicit.

---

## Contributing — Issue Creation

All work items (features, bugs, tasks) must be tracked as GitHub Issues before any code is written. 
This repository provides structured issue templates to ensure consistency across the backlog.

### Available Templates

| Template       | Use for                                                    |
|----------------|------------------------------------------------------------|
| **Epic**       | A high-level feature area grouping multiple related issues |
| **Feature**    | A user story or use case to implement                      |
| **Task**       | A technical sub-task of a feature                          |
| **Bug Report** | A defect or regression                                     |

To create an issue, navigate to the **Issues** tab and click **New issue**. 
Select the appropriate template. All mandatory fields must be completed before the issue is submitted.

### Required Fields

Every issue must include, at minimum:

- A title following the pattern `[TYPE] Short description` (pre-filled by the template)
- A bounded context (`auth`, `room`, or `video-sync`)
- Acceptance criteria or a Definition of Done
- The corresponding project fields set in the GitHub Project board: Priority, Risk Level, Sprint, Estimate, Phase, Bounded Context

Issues that do not use a template or that leave mandatory fields empty will be closed pending correction.

### Pull Requests

Every change to `main` must go through a pull request. 
Direct pushes to `main` are blocked by the branch protection ruleset.

PR titles must follow the same Conventional Commits format as individual commit messages. 
The PR description must reference the issue it closes using the keyword `Closes #<issue-number>`.

---

## Labels Reference

Labels are used to categorize issues by type and bounded context. 
Priority and Risk Level are managed as project-level custom fields on the GitHub Project board, not as labels.

**Type labels:**

| Label     | Usage                       |
|-----------|-----------------------------|
| `epic`    | High-level feature grouping |
| `feature` | User story or use case      |
| `task`    | Technical sub-task          |
| `bug`     | Defect or regression        |
| `test`    | Test-only issue             |
| `docs`    | Documentation               |
| `infra`   | Infrastructure or tooling   |

**Bounded context labels:**

| Label        | Usage                                 |
|--------------|---------------------------------------|
| `auth`       | Authentication bounded context        |
| `room`       | Room bounded context                  |
| `video-sync` | Video Synchronisation bounded context |