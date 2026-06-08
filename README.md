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

Run only the database in Docker and the API locally — gives you hot reload and easier debugging.

### Start

```bash
# 1. Start the database (schema is created automatically on first run)
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
| `docker compose up -d` | Start the database (dev) |
| `docker compose down` | Stop the database (dev) |
| `docker compose down -v` | Stop and **delete all DB data** |
| `docker compose logs -f postgres` | View database logs |
| `npm run start:dev` | Start API with hot reload |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Revert last migration |

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

## Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migration:generate -- src/database/migrations/<Name>` | Generate migration from entity changes |
| `npm run migration:run` | Apply all pending migrations |
| `npm run migration:revert` | Revert the last migration |

**Example — after modifying an entity:**
```bash
npm run migration:generate -- src/database/migrations/AddPhoneToUsers
npm run migration:run
```

**Required scripts in `package.json`:**
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