/**
 * Read-only probe of CPT2K16 (DB_*) and interactive-site prod (PROD_DB_*).
 * Loads repo-root `.env.local`. Requires network/VPN reachability to both hosts.
 *
 * Usage: npm run test:sql
 */

const path = require('path');
const dotenv = require('dotenv');
const sql = require('mssql');

const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local') });

/** @returns {import('mssql').config} */
function poolConfigFromEnv(prefix) {
  const isProd = prefix === 'PROD_DB_';
  const server = process.env[`${prefix}SERVER`];
  const database = process.env[`${prefix}DATABASE`];
  const user = process.env[`${prefix}USER`];
  const password = process.env[`${prefix}PASSWORD`];
  const portRaw = process.env[`${prefix}PORT`];
  const label = isProd ? 'PROD (10.0.0.5 / interactive-site)' : 'CPT2K16 (DB_*)';

  const missing = [];
  if (!server) missing.push(`${prefix}SERVER`);
  if (!database) missing.push(`${prefix}DATABASE`);
  if (!user) missing.push(`${prefix}USER`);
  if (!password) missing.push(`${prefix}PASSWORD`);
  if (missing.length) {
    throw new Error(`${label}: missing env: ${missing.join(', ')}`);
  }

  const port = portRaw ? parseInt(portRaw, 10) : 1433;
  if (Number.isNaN(port)) {
    throw new Error(`${label}: invalid ${prefix}PORT`);
  }

  return {
    server,
    database,
    user,
    password,
    port,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
  };
}

async function probe(label, config) {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    const result = await pool.request().query(`
      SELECT @@SERVERNAME AS server_name,
             DB_NAME() AS current_database,
             GETDATE() AS server_local_time;
    `);
    const row = result.recordset[0];
    console.log(`[OK] ${label}`);
    console.log(`     @@SERVERNAME: ${String(row.server_name)}`);
    console.log(`     DB_NAME():    ${String(row.current_database)}`);
    console.log(`     GETDATE():    ${String(row.server_local_time)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] ${label}: ${msg}`);
    throw err;
  } finally {
    await pool.close();
  }
}

async function main() {
  const dbConfig = poolConfigFromEnv('DB_');
  const prodConfig = poolConfigFromEnv('PROD_DB_');

  console.log('SQL read-only connection test (internal-dashboard)\n');
  await probe('CPT2K16', dbConfig);
  console.log('');
  await probe('Interactive-site production', prodConfig);
  console.log('\nBoth probes completed successfully.');
}

main().catch(() => {
  process.exitCode = 1;
});
