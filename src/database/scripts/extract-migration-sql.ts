import 'dotenv/config';
import { readdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Runs every migration's up() against a fake QueryRunner that records the SQL
 * it was asked to execute instead of running it, so the statements can be fed
 * to an external SQL linter (e.g. squawk) without touching a real database.
 *
 * This only sees SQL passed to queryRunner.query() — migrations written with
 * TypeORM's Table/TableColumn API (createTable/addColumn/...) won't be captured.
 *
 * Usage: extract-migration-sql.ts [outputFile] [migrationFile ...]
 * With no migration files, every migration is extracted. Pass specific files
 * (basenames, relative, or absolute paths — only the basename is matched) to
 * scope it to just those. CI passes basenames from `git diff --name-only`;
 * the lint-staged hook passes the absolute paths git hands it. Either way
 * this limits linting to migrations that are actually new/changed, instead
 * of re-flagging the entire, already-applied migration history.
 */

const MIGRATIONS_DIR = join(__dirname, '../migrations');
const OUTPUT_FILE = process.argv[2] ?? join(process.cwd(), 'migration-sql.sql');
const FILE_FILTER = new Set(process.argv.slice(3).map((file) => basename(file)));

type MigrationCtor = new () => MigrationInterface;

function isMigrationCtor(value: unknown): value is MigrationCtor {
  return (
    typeof value === 'function' &&
    typeof (value as { prototype?: { up?: unknown } }).prototype?.up === 'function'
  );
}

// Stands in for QueryRunner on any property/method a migration might touch
// besides query(): every access yields another callable/awaitable inert proxy,
// so unexpected calls (hasTable, getTable, connection, ...) no-op instead of throwing.
function createInertProxy(): unknown {
  const target = () => undefined;
  const proxy: unknown = new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (prop === Symbol.iterator) return (): Iterator<unknown> => [][Symbol.iterator]();
      // Coercion (String(), Number(), parseInt(), template literals, `${x}`, ...)
      // must bottom out in a primitive rather than another proxy, or ToPrimitive throws.
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'valueOf') return () => 0;
      if (prop === 'toString') return () => '0';
      return proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

function createRecordingQueryRunner(onQuery: (sql: string) => void): QueryRunner {
  const recorder = {
    query: (sql: string): Promise<unknown> => {
      onQuery(sql);
      return Promise.resolve(createInertProxy());
    },
  };

  return new Proxy(recorder, {
    get(target, prop) {
      if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
      return createInertProxy();
    },
  }) as unknown as QueryRunner;
}

async function extractSql(): Promise<string[]> {
  const statements: string[] = [];
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.ts'))
    .filter((file) => FILE_FILTER.size === 0 || FILE_FILTER.has(file))
    .sort();

  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const migrationModule: Record<string, unknown> = require(join(MIGRATIONS_DIR, file));
    const MigrationClass = Object.values(migrationModule).find(isMigrationCtor);

    if (!MigrationClass) {
      console.warn(`[extract-migration-sql] Skipping ${file}: no MigrationInterface class found`);
      continue;
    }

    const instance = new MigrationClass();
    const queryRunner = createRecordingQueryRunner((sql) => {
      statements.push(`-- ${file}\n${sql.trim()};`);
    });

    try {
      await instance.up(queryRunner);
    } catch (error) {
      console.error(`[extract-migration-sql] Failed running up() for ${file}:`, error);
      process.exitCode = 1;
    }
  }

  return statements;
}

void extractSql().then((statements) => {
  writeFileSync(OUTPUT_FILE, statements.length > 0 ? `${statements.join('\n\n')}\n` : '');
  console.log(`[extract-migration-sql] Wrote ${statements.length} statement(s) to ${OUTPUT_FILE}`);
});
