# 🚀 Getting Started

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) — only needed for local development

---

## First-time Setup (do this once)

### Step 1 — Clone the repository

```bash
git clone https://github.com/Su26-SEP490-G57/Su26_SEP490_G57_BE.git
cd Su26_SEP490_G57_BE
```

### Step 2 — Create your `.env` file

```bash
cp .env.example .env
```

> Never commit `.env` to git.

---

## 👨‍💻 Local Development

Run the database and Redis in Docker, and the API locally — gives you hot reload and easier debugging.

### Start

```bash
# 1. Start PostgreSQL + Redis (schema is created automatically on first run)
docker compose up -d

# 2. Install dependencies (first time only)
npm install

# 3. Run pending migrations
npm run migration:run

# 4. Start the API with hot reload
npm run start:dev
```

If you see `Application is running on: http://localhost:3000` — you're good to go ✅

### Stop

```bash
# Stop the API: Ctrl + C in the terminal
docker compose down
```

### After pulling new changes

```bash
git pull
npm run migration:run
npm run start:dev
```

---

## 🚀 Production

Uses `docker-compose.prod.yml` which runs both the database and the app container together.

### Start

```bash
docker compose -f docker-compose.prod.yml up -d
```

This will:
- Start PostgreSQL and create the `${DB_SCHEMA}` schema automatically
- Wait for the database to be healthy
- Start the app container

### Stop

```bash
docker compose -f docker-compose.prod.yml down
```

### After deploying new changes

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

> ⚠️ Run migrations manually after deploying if the app doesn't auto-run them on startup:
> ```bash
> docker compose -f docker-compose.prod.yml exec app npm run migration:run
> ```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start PostgreSQL + Redis (dev) |
| `docker compose down` | Stop all services (dev) |
| `docker compose down -v` | Stop and **delete all data** (Postgres + Redis) |
| `docker compose logs -f postgres-local` | View PostgreSQL logs |
| `docker compose logs -f redis-local` | View Redis logs |
| `npm run start:dev` | Start API with hot reload |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Revert last migration |

---

## Queue System (Redis + Bull)

The application uses **Bull** (backed by Redis) for background job processing.

### Use Cases

| Queue | Purpose | Trigger |
|-------|---------|---------|
| `auto-complete` | Auto-complete patient ERAS protocol when reaching max diet level + GREEN status for 24h | Delayed job scheduled when patient reaches max diet level |
| `yellow-reminder` | Send reminder notifications for pending YELLOW alerts | Scheduled via cron (configurable interval) |

### Architecture

```
NestJS App → Bull Queue → Redis → Bull Worker (Processor)
```

- **Queue Registration**: `BullModule.registerQueue({ name: 'queue-name' })` in feature modules
- **Job Producer**: Services add jobs via `this.queue.add('job-name', payload, options)`
- **Job Processor**: Classes decorated with `@Processor('queue-name')` handle jobs
- **Job Handler**: Methods decorated with `@Process('job-name')` execute job logic

### Configuration

Redis connection is configured in `app.module.ts`:

```typescript
BullModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    redis: {
      host: config.get('REDIS_HOST') || 'localhost',
      port: parseInt(config.get('REDIS_PORT') || '6379', 10),
      password: config.get('REDIS_PASSWORD'),
    },
  }),
  inject: [ConfigService],
})
```

Environment variables (`.env`):
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=        # Optional, leave empty for local dev
```

### Local Development

Redis is included in `docker-compose.local.yml`:

```bash
docker compose up -d    # Starts both Postgres + Redis
docker compose ps       # Verify redis-local is running
```

### Monitoring Jobs (Optional)

To inspect jobs in Redis:

```bash
# Connect to Redis CLI
docker exec -it redis-local redis-cli

# List all keys (Bull stores jobs as bull:<queue-name>:*)
KEYS bull:*

# Check queue stats
LLEN bull:auto-complete:waiting
LLEN bull:auto-complete:active
LLEN bull:auto-complete:completed
LLEN bull:auto-complete:failed
```

Or use a GUI tool like [Bull Board](https://github.com/felixmosh/bull-board) (not included by default).

### Example: Auto-Complete Job Flow

1. **Trigger**: Patient reaches max diet level (e.g., level 4)
2. **Schedule Job**: `AutoCompleteService.scheduleAutoCompletion(caseId)` adds a delayed job (24h delay)
3. **Job Storage**: Bull stores job in Redis with `bull:auto-complete:delayed` key
4. **Execution**: After 24h, `AutoCompleteProcessor.handleCompletion()` runs
5. **Verification**: Checks if patient is still GREEN + max diet level + no pending RED alerts
6. **Action**: If conditions met → set `erasCompleted = true`, `isLocked = true`

### Troubleshooting

**Jobs not processing?**
```bash
# Check if Redis is running
docker compose ps

# Check Redis logs
docker compose logs redis-local

# Verify Redis connectivity from app
# (App logs will show Bull connection errors if Redis is unreachable)
npm run start:dev
```

**Clear stuck jobs (development only)**
```bash
# Flush all Redis data (WARNING: deletes everything)
docker exec -it redis-local redis-cli FLUSHALL

# Or reset Docker volumes
docker compose down -v
docker compose up -d
```

---

## Database Connection (pgAdmin / DBeaver / TablePlus)

| Field | Value |
|-------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `SEP490_G57` |
| Schema | `SEP490_G57` |
| Username | `postgres` |
| Password | `postgres` |

---

## 🗄️ Making Changes to the Database Structure

Whenever you add a new field, rename a column, create a new table, or make any other schema change, follow these steps:

### Step 1 — Modify the entity file

Edit the relevant entity in `src/modules/<feature>/entities/<name>.entity.ts`.

For example, adding a `date_of_birth` field to the User entity:

```typescript
@Column({ type: 'date', nullable: true })
date_of_birth!: Date | null;
```

### Step 2 — Generate the migration

```bash
npm run migration:generate -- src/database/migrations/DescribeYourChange
```

Use a short descriptive name, for example:
```bash
npm run migration:generate -- src/database/migrations/AddDateOfBirthToUsers
npm run migration:generate -- src/database/migrations/CreatePatientNotesTable
npm run migration:generate -- src/database/migrations/RenameRoomBedColumn
```

TypeORM will diff your entities against the current database and generate the exact SQL needed. A new file will appear in `src/database/migrations/`.

> ⚠️ Always review the generated file before running it — make sure the SQL looks correct.

### Step 3 — Apply the migration

```bash
npm run migration:run
```

### Step 4 — Commit the migration file

```bash
git add src/database/migrations/
git commit -m "migration: AddDateOfBirthToUsers"
git push
```

> ⚠️ **Never edit an existing migration file.** Once committed and run, a migration is permanent. Always create a new one for each change.

### Reverting a migration

If something went wrong, revert the last migration:
```bash
npm run migration:revert
```
Then fix the entity, regenerate, and run again.

---

## Required scripts in `package.json`

```json
"migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts",
"migration:run":      "typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
"migration:revert":   "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts"
```

---

## When a Teammate Changes the DB Structure

```bash
git pull
npm run migration:run
```

> ⚠️ If you hit migration errors, reset your local DB:
> ```bash
> docker compose down -v
> docker compose up -d
> npm run migration:run
> ```

---

## Project Structure

```
.
├── src/
│   ├── config/                     # App configuration
│   ├── database/
│   │   ├── migrations/             # DB migration history
│   │   └── seeds/                  # Seed scripts
│   ├── modules/                    # Feature modules (auth, user, …)
│   ├── shared/                     # Guards, decorators, pipes
│   ├── app.module.ts
│   ├── data-source.ts              # TypeORM CLI config
│   └── main.ts
├── docker/
│   └── init/
│       └── 01-create-schema.sql    # Auto-runs on first DB startup
├── docker-compose.yml              # Local dev (DB only)
├── docker-compose.prod.yml         # Production (DB + app)
├── .env.example
└── .env                            # NOT committed to git
```

---

## Architecture Overview

This project follows **Clean Architecture** principles with NestJS feature modules:

```
Domain Layer (Business Logic)
  ↓ depends on
Application Layer (Use Cases, Services)
  ↓ depends on
Infrastructure Layer (Controllers, Repositories, External APIs)
```

### Key Modules

Located in `src/modules/`:

| Module | Responsibility |
|--------|---------------|
| `auth` | JWT authentication, token refresh, role-based guards |
| `patient` | Patient registration, room assignment, diet level management |
| `symptom-survey` | POMS questionnaires, assessment submission & triage calculation |
| `assessment` | Post-op assessment records, triage history, auto-lock logic |
| `alert` | RED alert detection, auto-lock (60 min), FCM push notifications |
| `nurse` | Nurse-patient room assignments, workload distribution |
| `care-observation` | Vital signs, I/O monitoring, recovery milestones |
| `diet-guidance` | Diet level progression (0-4), ERAS protocol tracking |
| `treatment-order` | Medication orders, surgical team instructions |
| `statistics` | Analytics, reporting, dashboard metrics |
| `firebase` | FCM integration for mobile push notifications |

### Primary Configuration

- **Database**: `src/data-source.ts` — TypeORM connection config for CLI and runtime
- **App Bootstrap**: `src/main.ts` — Swagger, validation pipes, CORS, port binding

---

## Business Rules

### Triage Classification

The system uses **GREEN/YELLOW/RED** triage levels for post-operative risk assessment, **not numerical scores**.

- Each survey option has an `optionTriageLevel` (GREEN/YELLOW/RED)
- Assessment triage is derived from selected options:
  - Any RED option → Assessment is RED
  - No RED, but has YELLOW → Assessment is YELLOW
  - Otherwise → Assessment is GREEN
- Legacy `score` columns exist for migration compatibility only — **do not use them for clinical decisions**

### Alert Auto-Lock

When a RED assessment is submitted:

1. **Auto-lock for 60 minutes** — prevents duplicate alerts for the same issue
2. **FCM push notification** sent to:
   - Primary: Nurse assigned to the patient's room
   - Fallback: Broadcast to all nurses if no room assignment exists
3. **Unlock condition**: `unlockNotifiedAt` is only set when `fcmResult.sent > 0` (delivery confirmed)

### Diet Level Scheduler

A cron job runs daily at **00:01 ICT** (`src/modules/symptom-survey/symptom-survey-task-scheduler.service.ts`):

- **Increments diet level** (0 → 1 → 2 → 3 → 4) if:
  - No PENDING RED alerts exist for the patient
  - Most recent assessment (today) is GREEN
  - Current diet level < max allowed for operation type
- **Does NOT decrement** — only manual downgrade by clinical staff
- **Skips patients** who haven't completed their daily assessment
- **Max diet level** (0-4) is dynamically queried from `pod_protocols` table based on `operationTypeId`

### Room-Code Normalization

All room-based assignments (nurse schedules, patient admissions) enforce **uppercase normalization**:

```typescript
// Example: "a01" → "A01"
room_code = room_code.toUpperCase();
```

This prevents duplicate assignments due to case-insensitive room codes (e.g., "A01" vs "a01").

### Soft Delete Filtering

Entities with `@DeleteDateColumn()` must apply soft-delete filters in queries:

```typescript
.where('entity.deletedAt IS NULL')
```

Missing this filter will leak deleted records into production queries.

---

## Testing

### Run Tests

```bash
# Unit tests
npm run test

# E2E tests (399 tests covering all modules)
npm run test:e2e

# Coverage report
npm run test:cov

# Run specific test file
jest --config ./tests/jest.config.ts path/to/test-file.spec.ts
```

### Linting & Formatting

```bash
# ESLint check
npm run lint

# ESLint auto-fix
npm run lint:fix

# Prettier check
npm run format:check

# Prettier auto-fix
npm run format:fix
```

### Pre-commit Hooks

Husky runs `lint-staged` before every commit:
- Auto-fixes ESLint issues
- Formats code with Prettier
- Blocks commit if unfixable errors exist

### Migration SQL Review

Before running migrations, extract and review the SQL:

```bash
npm run migration:extract-sql
# Review migration-sql.sql
npm run migration:run
```

---

## Troubleshooting

**Port 5432 already in use**
```bash
# Stop your local PostgreSQL, or change the port in docker-compose.yml to "5433:5432"
```

**Schema does not exist error**
```bash
# The init script only runs on a fresh volume — reset the DB:
docker compose down -v
docker compose up -d
npm run migration:run
```

**Want to reset the database completely**
```bash
docker compose down -v
docker compose up -d
npm run migration:run
```
