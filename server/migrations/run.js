const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function runMigration() {
  let conn;
  try {
    conn = await mariadb.createConnection({
      host: process.env.DFLOW_DB_HOST,
      port: process.env.DFLOW_DB_PORT || 3306,
      user: process.env.DFLOW_DB_USER,
      password: process.env.DFLOW_DB_PASSWORD,
      database: process.env.DFLOW_DB_NAME,
      multipleStatements: true,
    });

    console.log('✅ Connected to MariaDB');

    // Find all .sql migration files and sort them
    const migrationDir = __dirname;
    const sqlFiles = fs.readdirSync(migrationDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📄 Found ${sqlFiles.length} migration file(s): ${sqlFiles.join(', ')}\n`);

    for (const sqlFile of sqlFiles) {
      console.log(`--- Running: ${sqlFile} ---`);
      const sqlContent = fs.readFileSync(path.join(migrationDir, sqlFile), 'utf8');

      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const stmt of statements) {
        try {
          await conn.query(stmt);
          const preview = stmt.replace(/\s+/g, ' ').substring(0, 70);
          console.log(`  ✓ ${preview}...`);
        } catch (err) {
          // Tolerate "already exists" errors
          if (
            err.code === 'ER_DB_CREATE_EXISTS' ||
            err.code === 'ER_TABLE_EXISTS_ERROR' ||
            err.errno === 1060 // Duplicate column name
          ) {
            const preview = stmt.replace(/\s+/g, ' ').substring(0, 70);
            console.log(`  ⏭ Already exists: ${preview}...`);
          } else {
            console.error(`  ✗ Error: ${err.message}`);
            console.error(`    Statement: ${stmt.substring(0, 120)}...`);
          }
        }
      }
      console.log('');
    }

    console.log('🎉 All migrations completed!');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

runMigration();
