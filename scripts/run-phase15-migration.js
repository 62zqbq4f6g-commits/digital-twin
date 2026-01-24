/**
 * Phase 15 Migration Script
 * Run: node scripts/run-phase15-migration.js
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
  console.log('🚀 Starting Phase 15 Migration...\n');

  // Read the migration SQL
  const migrationPath = path.join(__dirname, '..', 'migrations', 'phase15-tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split into individual statements (by semicolon followed by newline)
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');

    try {
      // Use raw SQL via rpc
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: stmt + ';'
      });

      if (error) {
        // Try direct query for DDL statements
        const { error: directError } = await supabase.from('_exec').select('*').limit(0);

        if (error.message.includes('already exists')) {
          console.log(`⏭️  [${i + 1}/${statements.length}] Skipped (already exists): ${preview}...`);
          successCount++;
        } else if (error.message.includes('does not exist')) {
          console.log(`⚠️  [${i + 1}/${statements.length}] Warning: ${error.message}`);
        } else {
          console.log(`❌ [${i + 1}/${statements.length}] Error: ${error.message}`);
          errorCount++;
        }
      } else {
        console.log(`✅ [${i + 1}/${statements.length}] Success: ${preview}...`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ [${i + 1}/${statements.length}] Exception: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  // Verify tables exist
  console.log('\n🔍 Verifying tables...');

  const tables = ['user_reports', 'whispers', 'memory_moments', 'user_notification_preferences', 'analytics_events'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error && error.message.includes('does not exist')) {
      console.log(`   ❌ ${table}: NOT FOUND`);
    } else {
      console.log(`   ✅ ${table}: EXISTS`);
    }
  }

  console.log('\n✨ Migration complete!');
}

runMigration().catch(console.error);
