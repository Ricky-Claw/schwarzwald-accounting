#!/usr/bin/env node
// ============================================
// SUPABASE SQL MIGRATION TOOL
// ============================================

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_TABLE = '_migrations';

// Ensure migrations directory exists
if (!fs.existsSync(MIGRATIONS_DIR)) {
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
}

// Database connection config
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function createMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW(),
      checksum TEXT,
      duration_ms INTEGER
    )
  `);
}

async function getExecutedMigrations(client) {
  const result = await client.query(`SELECT filename FROM ${MIGRATION_TABLE}`);
  return new Set(result.rows.map(r => r.filename));
}

async function executeMigration(client, filename, sql) {
  const startTime = Date.now();
  const checksum = require('crypto').createHash('md5').update(sql).digest('hex');
  
  console.log(`\n📄 Executing: ${filename}`);
  
  try {
    // Execute in transaction
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    const duration = Date.now() - startTime;
    
    // Record migration
    await client.query(
      `INSERT INTO ${MIGRATION_TABLE} (filename, checksum, duration_ms) VALUES ($1, $2, $3)`,
      [filename, checksum, duration]
    );
    
    console.log(`✅ Completed in ${duration}ms`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed: ${error.message}`);
    throw error;
  }
}

async function migrate() {
  console.log('🚀 Supabase Migration Tool');
  console.log('==========================\n');
  
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Create migration tracking table
    await createMigrationTable(client);
    
    // Get executed migrations
    const executed = await getExecutedMigrations(client);
    console.log(`📊 ${executed.size} migrations already executed`);
    
    // Get pending migrations
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    const pending = files.filter(f => !executed.has(f));
    
    if (pending.length === 0) {
      console.log('\n✨ No pending migrations');
      return;
    }
    
    console.log(`\n📝 ${pending.length} pending migration(s):`);
    pending.forEach(f => console.log(`   - ${f}`));
    
    // Execute pending migrations
    console.log('\n▶️  Executing migrations...\n');
    
    for (const filename of pending) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, 'utf8');
      
      await executeMigration(client, filename, sql);
    }
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration
migrate();
