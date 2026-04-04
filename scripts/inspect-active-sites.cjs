/**
 * Read-only inspection for cptgroupmaster.dbo.ocbautomation.
 * Purpose: discover active-site fields for Website Health mapping.
 *
 * Usage:
 *   node scripts/inspect-active-sites.cjs
 */

const path = require('path');
const dotenv = require('dotenv');
const sql = require('mssql');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

async function main() {
  const pool = new sql.ConnectionPool({
    server: required('DB_SERVER'),
    database: 'master',
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    port: parseInt(process.env.DB_PORT || '1433', 10),
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
  });

  await pool.connect();
  try {
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM [cptgroupmaster].INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ocbautomation'
      ORDER BY ORDINAL_POSITION;
    `);
    console.log('=== ocbautomation columns ===');
    columns.recordset.forEach((r) => {
      console.log(`${r.COLUMN_NAME} | ${r.DATA_TYPE}`);
    });

    const activeCounts = await pool.request().query(`
      SELECT
        SUM(CASE WHEN ISNULL(IsActive, 0) = 1 THEN 1 ELSE 0 END) AS active_count,
        COUNT(*) AS total_count
      FROM [cptgroupmaster].dbo.[ocbautomation];
    `);
    const countsRow = activeCounts.recordset[0] || { active_count: 0, total_count: 0 };
    console.log('\n=== counts ===');
    console.log(`active_count: ${countsRow.active_count}`);
    console.log(`total_count:  ${countsRow.total_count}`);

    const activeSample = await pool.request().query(`
      SELECT TOP 25
        Name,
        ProjectName,
        IsActive
      FROM [cptgroupmaster].dbo.[ocbautomation]
      WHERE ISNULL(IsActive, 0) = 1
      ORDER BY Name ASC;
    `);
    console.log('\n=== active sample (top 25) ===');
    activeSample.recordset.forEach((r) => {
      console.log(`${r.Name} | ${r.ProjectName} | ${r.IsActive}`);
    });
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

