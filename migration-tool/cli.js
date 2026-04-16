#!/usr/bin/env node
// ============================================
// MIGRATION CLI - Create new migrations
// ============================================

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function createMigration(name) {
  if (!name) {
    console.error('❌ Please provide a migration name');
    console.log('Usage: node cli.js create "add users table"');
    process.exit(1);
  }
  
  // Ensure migrations directory exists
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
  
  // Generate timestamp
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);
  
  // Template
  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL here
-- Example:
-- ALTER TABLE receipts ADD COLUMN new_field TEXT;

`;
  
  fs.writeFileSync(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
  console.log(`📁 Location: ${filepath}`);
}

// CLI Commands
const command = process.argv[2];
const arg = process.argv.slice(3).join(' ');

switch (command) {
  case 'create':
    createMigration(arg);
    break;
  default:
    console.log('Supabase Migration CLI');
    console.log('======================\n');
    console.log('Commands:');
    console.log('  node cli.js create "migration name"  - Create new migration');
    console.log('  npm run migrate                       - Run all pending migrations');
    console.log('');
}
