const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kkedspfbphcelkhaucip.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrZWRzcGZicGhjZWxraGF1Y2lwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA0MTIwOCwiZXhwIjoyMDgzNjE3MjA4fQ._2vuKjJarYztUxmutRBhxY64_X9qftljSUN7CcxQEFQ'
);

async function checkGaps() {
  console.log('=== MEM0 GAP ANALYSIS ===\n');

  // Check 1: Entity type constraint
  console.log('1. ENTITY TYPE CONSTRAINT');
  const { error: insertErr } = await supabase
    .from('user_entities')
    .insert({
      id: '00000000-0000-0000-0000-000000000099',
      user_id: 'f740bd76-547f-42a1-a95e-1be7e022b051',
      name: 'Test Event',
      entity_type: 'event',
      memory_type: 'event',
      summary: 'Test',
      status: 'active'
    });

  if (insertErr) {
    if (insertErr.message.includes('entity_type')) {
      console.log('   ❌ entity_type constraint needs expansion (event not allowed)');
    } else {
      console.log('   ⚠️  Other error:', insertErr.message);
    }
  } else {
    console.log('   ✅ entity_type constraint allows "event"');
    // Clean up
    await supabase.from('user_entities').delete().eq('id', '00000000-0000-0000-0000-000000000099');
  }

  // Check 2: memory_jobs table
  console.log('\n2. MEMORY_JOBS TABLE');
  const { data: jobs, error: jobsErr } = await supabase
    .from('memory_jobs')
    .select('id')
    .limit(1);

  if (jobsErr) {
    console.log('   ❌ memory_jobs table does not exist:', jobsErr.message);
  } else {
    console.log('   ✅ memory_jobs table exists');
  }

  // Check 3: entity_sentiment_history table
  console.log('\n3. ENTITY_SENTIMENT_HISTORY TABLE');
  const { data: sentiment, error: sentimentErr } = await supabase
    .from('entity_sentiment_history')
    .select('id')
    .limit(1);

  if (sentimentErr) {
    console.log('   ❌ entity_sentiment_history table does not exist');
  } else {
    const { count } = await supabase
      .from('entity_sentiment_history')
      .select('*', { count: 'exact', head: true });
    console.log('   ✅ entity_sentiment_history exists with', count || 0, 'records');
  }

  // Check 4: Entities with sentiment_average
  console.log('\n4. SENTIMENT DATA');
  const { data: withSentiment } = await supabase
    .from('user_entities')
    .select('id, name, sentiment_average')
    .not('sentiment_average', 'is', null)
    .limit(5);

  if (withSentiment?.length) {
    console.log('   ✅ Found', withSentiment.length, 'entities with sentiment:');
    withSentiment.forEach(e => console.log(`      - ${e.name}: ${e.sentiment_average}`));
  } else {
    console.log('   ⚠️  No entities have sentiment_average populated yet');
  }

  // Check 5: Entities eligible for decay
  console.log('\n5. DECAY CANDIDATES');
  const { data: decayCandidates } = await supabase
    .from('user_entities')
    .select('name, importance, importance_score, updated_at')
    .eq('status', 'active')
    .in('importance', ['trivial', 'low', 'medium'])
    .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5);

  if (decayCandidates?.length) {
    console.log('   Found', decayCandidates.length, 'entities eligible for decay:');
    decayCandidates.forEach(e => {
      console.log(`      - ${e.name} (${e.importance}): score=${e.importance_score}`);
    });
  } else {
    console.log('   ℹ️  No entities currently eligible for decay (all recently updated)');
  }

  // Summary
  console.log('\n=== MIGRATION FILES CREATED ===');
  console.log('Run these in order in Supabase SQL Editor:');
  console.log('1. supabase/migrations/20260121_create_memory_jobs_table.sql');
  console.log('2. supabase/migrations/20260121_fix_entity_type_and_sentiment.sql');
  console.log('3. supabase/migrations/20260121_enable_pg_cron.sql');
  console.log('4. supabase/migrations/20260121_create_cron_jobs.sql');
  console.log('5. supabase/migrations/20260121_verify_setup.sql (verification)');
}

checkGaps().catch(console.error);
