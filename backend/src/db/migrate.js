import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { assertEnv } from '../config/env.js';
assertEnv();
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../migrations');
await pool.query('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  const done = await pool.query('SELECT 1 FROM _migrations WHERE name=$1', [file]);
  if (done.rowCount) continue;
  const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
  const client = await pool.connect();
  try { await client.query('BEGIN'); await client.query(sql); await client.query('INSERT INTO _migrations(name) VALUES($1)', [file]); await client.query('COMMIT'); console.log(`Applied ${file}`); }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
await pool.end();
console.log('Migrations complete.');
