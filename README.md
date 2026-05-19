# 🚀 Getting Started

## Prerequisites

Make sure you have the following installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (only if running the API locally for development)

> PostgreSQL runs inside Docker — no need to install it locally.

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

> The `.env` file contains your local database credentials. Never commit this file to git.

### Step 3 — Start the project

```bash
docker compose up --build -d
```

This will automatically:
- Start a PostgreSQL database
- Run all migrations (tables will be created automatically)
- Start the NestJS API

### Step 4 — Verify it's running

```bash
docker compose logs -f api
```

If you see `Application is running on: http://localhost:3000` — you're good to go ✅

---

## Everyday Usage (after pulling new changes)

```bash
git pull
docker compose up --build -d
```

> Use `--build` to rebuild the image when there are code changes. You can skip it if nothing in the Dockerfile changed.

---

## Common Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start the project (background) |
| `docker compose up --build -d` | Rebuild and start |
| `docker compose down` | Stop the project |
| `docker compose down -v` | Stop and **delete all DB data** |
| `docker compose logs -f api` | View API logs |
| `docker compose logs -f postgres` | View database logs |
| `docker compose ps` | Check service status |

---

## Database Connection (pgAdmin / DBeaver / TablePlus)

| Field | Value |
|-------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `SEP490_G57` |
| Username | `postgres` |
| Password | `postgres` |

---

## When a Teammate Changes the DB Structure

When someone adds or modifies an **entity**, they will generate a new migration and push it to git. When you pull their changes, just run:

```bash
docker compose up --build -d
```

Migrations will be applied automatically on startup.

> ⚠️ If you run into migration errors, reset your local DB with `docker compose down -v` then `docker compose up --build -d`.

---

## Project Structure

```
.
├── src/
│   ├── migrations/        # DB migration history
│   ├── data-source.ts     # TypeORM CLI config
│   └── app.module.ts      # DB connection config
├── Dockerfile
├── docker-compose.yml
├── .env.example           # Environment variable template (committed to git)
├── .env                   # Your local env file (NOT committed)
└── .dockerignore
```

---

## Local Development (recommended)

When actively developing, run only the database in Docker and start the API manually — this gives you hot reload and easier debugging.

**Make sure your `.env` has:**
```env
DB_HOST=localhost
```

```bash
# Start only the database
docker compose up postgres -d

# Install dependencies (first time only)
npm install

# Run NestJS with hot reload
npm run start:dev
```

> NestJS CLI (`nest start --watch`) handles hot reload out of the box — no need to install nodemon.

To stop:
```bash
# Stop the API: Ctrl + C in the terminal

# Stop the database
docker compose down
```

---

## Troubleshooting

**Port 5432 already in use**
```bash
# You may have a local PostgreSQL running on your machine.
# Stop it, or change the port mapping in docker-compose.yml to "5433:5432"
```

**API can't connect to the database**
```bash
# Check the logs for details
docker compose logs api

# Try restarting the API
docker compose restart api
```

**Want to reset the database completely**
```bash
docker compose down -v
docker compose up --build -d
```
