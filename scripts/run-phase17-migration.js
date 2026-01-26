/**
 * Phase 17 Migration Script - Ambient Recordings Table
 * Run: node scripts/run-phase17-migration.js
 *
 * Creates:
 * - ambient_recordings table for chunked upload sessions
 * - Adds source, raw_input, enhancement_metadata columns to notes
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runMigration() {
  console.log('🚀 Starting Phase 17 Migration (Ambient Recordings)...\n');

  // Read the migration SQL
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20260125_phase17_ambient_recordings.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Remove comments and split into statements
  const cleanedSql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  // Split by semicolons, handling DO $$ blocks specially
  const statements = [];
  let current = '';
  let inBlock = false;

  for (const line of cleanedSql.split('\n')) {
    if (line.includes('DO $$')) {
      inBlock = true;
    }
    current += line + '\n';
    if (line.includes('$$ ;') || line.includes('$$;') || (line.trim() === 'END $$;')) {
      inBlock = false;
      statements.push(current.trim());
      current = '';
    } else if (!inBlock && line.includes(';') && !line.includes('$$')) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  const filteredStatements = statements.filter(s => s.length > 5);
  console.log(`📋 Found ${filteredStatements.length} SQL statements to execute\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < filteredStatements.length; i++) {
    const stmt = filteredStatements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ').trim();

    try {
      // Try using rpc exec_sql if available
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: stmt
      });

      if (error) {
        if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        ) {
          console.log(
            `⏭️  [${i + 1}/${filteredStatements.length}] Skipped (exists): ${preview}...`
          );
          skipCount++;
        } else if (error.message.includes('function') && error.message.includes('does not exist')) {
          // exec_sql not available - provide manual instructions
          console.log(`\n⚠️  exec_sql RPC not available. Please run migration manually in Supabase Dashboard.`);
          console.log(`\nSQL to run:\n`);
          console.log(sql);
          process.exit(0);
        } else {
          console.log(
            `❌ [${i + 1}/${filteredStatements.length}] Error: ${error.message.slice(0, 100)}`
          );
          errorCount++;
        }
      } else {
        console.log(
          `✅ [${i + 1}/${filteredStatements.length}] Success: ${preview}...`
        );
        successCount++;
      }
    } catch (err) {
      console.log(
        `❌ [${i + 1}/${filteredStatements.length}] Exception: ${err.message.slice(0, 100)}`
      );
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  // Verify table exists
  console.log('\n🔍 Verifying tables...');

  const { data, error: verifyError } = await supabase
    .from('ambient_recordings')
    .select('id')
    .limit(1);

  if (verifyError && verifyError.message.includes('does not exist')) {
    console.log('   ❌ ambient_recordings: NOT FOUND');
    console.log('\n⚠️  Run the migration SQL manually in Supabase Dashboard SQL Editor:');
    console.log(`   File: supabase/migrations/20260125_phase17_ambient_recordings.sql`);
  } else if (verifyError) {
    console.log(`   ⚠️  ambient_recordings: ${verifyError.message}`);
  } else {
    console.log('   ✅ ambient_recordings: EXISTS');
  }

  console.log('\n✨ Migration script complete!');
}

runMigration().catch(console.error);
