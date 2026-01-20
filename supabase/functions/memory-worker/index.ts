/**
 * MEM0 BUILD 2: Supabase Edge Function - Memory Worker
 * Processes async memory jobs from the memory_jobs queue
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Fetch pending jobs (respecting dependencies)
    const { data: jobs, error: fetchError } = await supabase
      .from('memory_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10)

    if (fetchError) throw fetchError
    if (!jobs?.length) {
      return new Response(JSON.stringify({ processed: 0, message: 'No pending jobs' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Filter jobs with unmet dependencies
    const validJobs = []
    for (const job of jobs) {
      if (job.depends_on) {
        const { data: dep } = await supabase
          .from('memory_jobs')
          .select('status')
          .eq('id', job.depends_on)
          .single()

        if (dep?.status === 'completed') {
          validJobs.push(job)
        }
      } else {
        validJobs.push(job)
      }
    }

    const results = []

    for (const job of validJobs) {
      const jobStart = Date.now()

      // Mark as processing
      await supabase
        .from('memory_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1
        })
        .eq('id', job.id)

      try {
        let result

        switch (job.job_type) {
          case 'update':
            result = await processUpdateJob(job)
            break
          case 'consolidate':
            result = await processConsolidateJob(job)
            break
          case 'decay':
            result = await processDecayJob(job)
            break
          case 'cleanup':
            result = await processCleanupJob(job)
            break
          case 'graph_update':
            result = await processGraphUpdateJob(job)
            break
          case 'summary':
            result = await processSummaryJob(job)
            break
          case 'extract':
            result = await processExtractJob(job)
            break
          default:
            throw new Error(`Unknown job type: ${job.job_type}`)
        }

        // Mark completed
        await supabase
          .from('memory_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: {
              ...result,
              processing_time_ms: Date.now() - jobStart
            }
          })
          .eq('id', job.id)

        results.push({ job_id: job.id, status: 'completed', result })

      } catch (error: any) {
        // Handle failure with exponential backoff retry
        const attempts = job.attempts + 1
        const status = attempts >= job.max_attempts ? 'failed' : 'pending'
        const backoffSeconds = Math.pow(2, attempts) * 1000 // 2s, 4s, 8s...
        const scheduledFor = attempts < job.max_attempts
          ? new Date(Date.now() + backoffSeconds).toISOString()
          : job.scheduled_for

        await supabase
          .from('memory_jobs')
          .update({
            status,
            attempts,
            last_error: error.message,
            error_stack: error.stack,
            scheduled_for: scheduledFor
          })
          .eq('id', job.id)

        results.push({ job_id: job.id, status: 'failed', error: error.message })
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      results,
      total_time_ms: Date.now() - startTime
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// =====================================================
// Job Processors
// =====================================================

async function processUpdateJob(job: any) {
  const { fact, similar_memories, source_note_id } = job.payload
  const user_id = job.user_id

  // This will be fully implemented in Build 3 with LLM tool calling
  // For now, log the operation as pending implementation
  await logOperation(user_id, 'NOOP', fact?.content || fact, similar_memories || [],
    { reasoning: 'UPDATE phase pending Build 3 implementation' }, null, job.id, source_note_id)

  return { operation: 'NOOP', reason: 'Pending Build 3 implementation' }
}

async function processConsolidateJob(job: any) {
  const { force } = job.payload
  const user_id = job.user_id

  // Find entities with high embedding similarity
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, summary, embedding, memory_type, importance_score, mention_count')
    .eq('user_id', user_id)
    .eq('status', 'active')

  if (!entities?.length) return { consolidated: 0 }

  const candidates = []

  // Compare pairs using cosine similarity
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      if (!entities[i].embedding || !entities[j].embedding) continue

      const similarity = cosineSimilarity(entities[i].embedding, entities[j].embedding)

      if (similarity > 0.85) {
        candidates.push({
          entity1: entities[i],
          entity2: entities[j],
          similarity
        })
      }
    }
  }

  if (!force) {
    return {
      candidates: candidates.length,
      preview: candidates.slice(0, 5).map(c => ({
        entity1: c.entity1.name,
        entity2: c.entity2.name,
        similarity: (c.similarity * 100).toFixed(1) + '%'
      })),
      message: 'Run with force=true to consolidate'
    }
  }

  // Consolidate
  let consolidated = 0
  for (const candidate of candidates) {
    const keeper = (candidate.entity1.importance_score || 0.5) >= (candidate.entity2.importance_score || 0.5)
      ? candidate.entity1 : candidate.entity2
    const merged = keeper === candidate.entity1 ? candidate.entity2 : candidate.entity1

    // Merge summaries
    const mergedSummary = `${keeper.summary || ''}. ${merged.summary || ''}`.replace(/^\. /, '')

    await supabase
      .from('user_entities')
      .update({
        summary: mergedSummary,
        importance_score: Math.max(keeper.importance_score || 0.5, merged.importance_score || 0.5),
        mention_count: (keeper.mention_count || 0) + (merged.mention_count || 0),
        version: (keeper.version || 1) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', keeper.id)

    await supabase
      .from('user_entities')
      .update({
        status: 'archived',
        superseded_by: keeper.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', merged.id)

    await logOperation(user_id, 'CONSOLIDATE', merged.summary || merged.name, [],
      { reasoning: `Merged into ${keeper.name} (${(candidate.similarity * 100).toFixed(1)}% similar)` },
      keeper.id, job.id, null)

    consolidated++
  }

  return { consolidated }
}

async function processDecayJob(job: any) {
  const user_id = job.user_id

  // Apply decay to old, unaccessed memories
  const { data: decayed, error } = await supabase
    .from('user_entities')
    .update({
      importance_score: supabase.raw('GREATEST(0.05, importance_score * 0.9)')
    })
    .eq('user_id', user_id)
    .eq('status', 'active')
    .neq('importance', 'critical')
    .lt('last_accessed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .select('id')

  return { decayed: decayed?.length || 0, error: error?.message }
}

async function processCleanupJob(job: any) {
  const user_id = job.user_id

  // Archive expired memories
  const { data: expired } = await supabase
    .from('user_entities')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('user_id', user_id)
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  // Archive very low importance memories older than 90 days
  const { data: decayed } = await supabase
    .from('user_entities')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('user_id', user_id)
    .eq('status', 'active')
    .eq('importance', 'trivial')
    .lt('importance_score', 0.1)
    .lt('updated_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .lt('last_accessed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .select('id')

  return {
    expired_archived: expired?.length || 0,
    decayed_archived: decayed?.length || 0
  }
}

async function processGraphUpdateJob(job: any) {
  const { source_entity_id, target_entity_id, relationship, strength } = job.payload
  const user_id = job.user_id

  // Upsert relationship
  const { error } = await supabase
    .from('entity_relationships')
    .upsert({
      user_id,
      source_entity_id,
      target_entity_id,
      relationship_type: relationship,
      strength: strength || 0.5,
      is_active: true,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'source_entity_id,target_entity_id,relationship_type'
    })

  return { updated: !error, error: error?.message }
}

async function processSummaryJob(job: any) {
  const { messages } = job.payload

  // Generate summary via Claude
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Summarize this conversation in 2-3 sentences, focusing on key facts and decisions:\n\n${messages}`
      }]
    })
  })

  const data = await response.json()
  const summary = data.content?.[0]?.text || ''

  return { summary }
}

async function processExtractJob(job: any) {
  const { note_id, content } = job.payload

  // Call the extract-entities API (would need to be called via HTTP in production)
  // For now, return placeholder
  return {
    note_id,
    extracted: 'Pending - call extract-entities API'
  }
}

// =====================================================
// Helper Functions
// =====================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0
  let dotProduct = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function logOperation(
  userId: string,
  operation: string,
  candidateFact: string,
  similarMemories: any[],
  reasoning: any,
  entityId: string | null,
  jobId: string | null,
  sourceNoteId: string | null
) {
  await supabase
    .from('memory_operations')
    .insert({
      user_id: userId,
      operation,
      candidate_fact: candidateFact,
      similar_memories: similarMemories,
      llm_reasoning: reasoning?.reasoning || JSON.stringify(reasoning),
      entity_id: entityId,
      job_id: jobId,
      source_note_id: sourceNoteId
    })
}
