/**
 * INSCRIPT: Edge Runtime Analyze Endpoint
 *
 * Optimized for speed using Edge Runtime + waitUntil:
 * - Critical path: Memory context + Reflection (< 5 seconds)
 * - Background: Entity extraction + Memory updates (non-blocking)
 *
 * Target: 20+ seconds → < 5 seconds response time
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, ctx) {
  const startTime = Date.now();

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const { input, userId, noteId, context = {} } = body;
    const content = input?.content || '';

    if (!content || content.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'Content too short' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Analyze-Edge] === CRITICAL PATH START ===');
    console.log('[Analyze-Edge] Content length:', content.length);
    console.log('[Analyze-Edge] User ID:', userId || 'anonymous');

    // ============================================
    // CRITICAL PATH (user waits for this only)
    // ============================================

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Initialize Anthropic
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Step 1: Fast memory context - Tier 1 only (category summaries + onboarding)
    let t0 = Date.now();
    const { memoryContext, onboardingData } = await getMemoryContextFast(supabase, userId);
    console.log(`[Analyze-Edge] Memory context: ${Date.now() - t0}ms`);

    // Step 2: Generate reflection with full note content
    t0 = Date.now();
    const reflection = await generateReflection(anthropic, content, memoryContext, onboardingData);
    console.log(`[Analyze-Edge] Reflection: ${Date.now() - t0}ms`);

    const criticalPathTime = Date.now() - startTime;
    console.log(`[Analyze-Edge] === CRITICAL PATH COMPLETE: ${criticalPathTime}ms ===`);

    // Step 3: Queue background work (user doesn't wait)
    if (ctx?.waitUntil) {
      ctx.waitUntil(
        processInBackground(supabase, anthropic, userId, noteId, content).catch(err => {
          console.error('[Background] Error:', err.message);
        })
      );
    } else {
      // Fallback: fire and forget (not ideal but works)
      processInBackground(supabase, anthropic, userId, noteId, content).catch(err => {
        console.error('[Background] Error:', err.message);
      });
    }

    // Step 4: Return immediately with reflection
    // Format matches original analyze.js flat response expected by processAPIResponse
    return new Response(
      JSON.stringify({
        // Tiered response format (Phase 8.8)
        tier: 2,
        heard: reflection.what_i_heard,
        noticed: reflection.what_i_noticed,
        question: reflection.question,
        // Standard fields
        title: generateTitle(content),
        summary: reflection.what_i_heard,
        cleanedInput: content,
        category: 'personal_reflection',
        type: 'observation',
        emotionalTone: 'neutral',
        confidence: 0.8,
        noteType: 'personal',
        // Empty defaults for optional fields
        actions: [],
        entities: { people: [], projects: [], topics: [] },
        patterns: { reinforced: [], new: [] },
        voice: { energy: 0.5, certainty: 0.5, pace: 'measured', formality: 0.5 },
        shareability: { ready: false, reason: '' },
        related_notes: [],
        memoryTags: [],
        visualEntities: [],
        // Edge-specific metadata
        _latency_ms: criticalPathTime,
        _memory_status: 'processing_in_background'
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[Analyze-Edge] Critical path error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================
// FAST MEMORY CONTEXT (Tier 1 Only)
// ============================================

async function getMemoryContextFast(supabase, userId) {
  if (!userId) {
    return { memoryContext: '', onboardingData: null };
  }

  try {
    // Parallel fetch: onboarding + category summaries
    const [onboardingResult, summariesResult] = await Promise.all([
      supabase
        .from('onboarding_data')
        .select('name, life_seasons, mental_focus, seeded_people, depth_answer')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('category_summaries')
        .select('category, summary')
        .eq('user_id', userId)
    ]);

    const onboardingData = onboardingResult.data;
    const summaries = summariesResult.data || [];

    // Build context string
    let contextParts = [];

    // Add onboarding context
    if (onboardingData) {
      if (onboardingData.name) {
        contextParts.push(`User's name: ${onboardingData.name}`);
      }
      if (onboardingData.life_seasons?.length > 0) {
        contextParts.push(`Life season: ${onboardingData.life_seasons.join(', ')}`);
      }
      if (onboardingData.mental_focus?.length > 0) {
        contextParts.push(`Currently focused on: ${onboardingData.mental_focus.join(', ')}`);
      }
      if (onboardingData.seeded_people?.length > 0) {
        const people = onboardingData.seeded_people
          .map(p => `${p.name}${p.context ? ` (${p.context})` : ''}`)
          .join(', ');
        contextParts.push(`Key people: ${people}`);
      }
    }

    // Add category summaries
    if (summaries.length > 0) {
      contextParts.push('\nWhat you know about the user:');
      for (const s of summaries) {
        contextParts.push(`[${s.category.toUpperCase()}]: ${s.summary}`);
      }
    }

    return {
      memoryContext: contextParts.join('\n'),
      onboardingData
    };

  } catch (error) {
    console.error('[Analyze-Edge] Memory context error:', error.message);
    return { memoryContext: '', onboardingData: null };
  }
}

// ============================================
// GENERATE REFLECTION
// ============================================

async function generateReflection(anthropic, content, memoryContext, onboardingData) {
  const userName = onboardingData?.name || 'there';

  const systemPrompt = `You are a thoughtful personal reflection assistant for Inscript, a personal AI memory app.

${memoryContext ? `WHAT YOU KNOW ABOUT THIS USER:\n${memoryContext}\n\n` : ''}

Your job is to reflect back what the user shared in a way that makes them feel HEARD and understood.

CRITICAL RULES:
1. Be SPECIFIC - reference actual names, places, dates, and details from their note
2. NEVER be vague or generic (no "something is stirring" or "this deserves attention")
3. If they mention a person by name (like "Sarah"), use that name
4. If they mention a place (like "Phuket"), reference it
5. If they mention a date or timeline (like "June 2026"), include it
6. Sound like a thoughtful friend, not a therapist or AI assistant

Respond in this exact JSON format:
{
  "what_i_heard": "A clear, specific summary that proves you understood their note - use their actual words, names, and details",
  "what_i_noticed": "A specific insight or observation about what this might mean for them - be concrete, not abstract",
  "question": "A single thoughtful question to help them reflect deeper - directly related to what they shared"
}

EXAMPLES OF BAD vs GOOD:

BAD what_i_heard: "You mentioned something about planning."
GOOD what_i_heard: "Sarah asked you to plan a company trip to Phuket in June 2026, focused on wellness activities for employee mental health."

BAD what_i_noticed: "Something is stirring here that deserves attention."
GOOD what_i_noticed: "This is a significant responsibility - you're being trusted to design an experience that could meaningfully impact your team's wellbeing."

BAD question: "What are you feeling about this?"
GOOD question: "What wellness activities do you think would resonate most with your team?"`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      temperature: 0.4,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is my note:\n\n"${content}"\n\nReflect on this thoughtfully and specifically.`
        }
      ]
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}';

    // Try to parse JSON, handle various formats
    try {
      // Clean up potential markdown code blocks
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.slice(7);
      }
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.slice(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.slice(0, -3);
      }

      return JSON.parse(cleanText.trim());
    } catch {
      // If JSON parse fails, create structured response from text
      console.warn('[Analyze-Edge] JSON parse failed, using text:', text.substring(0, 100));
      return {
        what_i_heard: text,
        what_i_noticed: '',
        question: ''
      };
    }
  } catch (error) {
    console.error('[Analyze-Edge] Reflection error:', error.message);
    return {
      what_i_heard: 'I received your note but had trouble processing it.',
      what_i_noticed: '',
      question: 'Could you tell me more about what you shared?'
    };
  }
}

// ============================================
// GENERATE TITLE (simple extraction)
// ============================================

function generateTitle(content) {
  // Take first meaningful phrase, max 50 chars
  const words = content.trim().split(/\s+/);
  let title = words.slice(0, 8).join(' ');
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// ============================================
// BACKGROUND PROCESSING (User doesn't wait)
// ============================================

async function processInBackground(supabase, anthropic, userId, noteId, content) {
  const startTime = Date.now();
  console.log('[Background] === START ===');

  if (!userId) {
    console.log('[Background] No userId, skipping memory updates');
    return;
  }

  try {
    // Step 1: Extract entities
    let t0 = Date.now();
    const entities = await extractEntities(anthropic, content);
    console.log(`[Background] Entity extraction: ${Date.now() - t0}ms, found ${entities.length} entities`);

    if (entities.length === 0) {
      console.log('[Background] No entities found, skipping memory update');
      return;
    }

    // Step 2: Generate embeddings in batch (one API call)
    t0 = Date.now();
    const textsToEmbed = entities.map(e => `${e.name}: ${e.description || e.entity_type}`);
    const embeddings = await generateEmbeddingsBatch(textsToEmbed);
    entities.forEach((e, i) => { e.embedding = embeddings[i]; });
    console.log(`[Background] Embeddings batch: ${Date.now() - t0}ms`);

    // Step 3: Parallel - save entities + update summaries
    t0 = Date.now();
    await Promise.all([
      saveEntitiesWithBoost(supabase, userId, entities, noteId),
      updateCategorySummariesSafe(supabase, anthropic, userId, entities)
    ]);
    console.log(`[Background] Save + summaries: ${Date.now() - t0}ms`);

    console.log(`[Background] === COMPLETE: ${Date.now() - startTime}ms ===`);

  } catch (error) {
    console.error('[Background] Failed:', error.message);
    // Don't throw - background errors shouldn't affect anything
  }
}

// ============================================
// ENTITY EXTRACTION
// ============================================

async function extractEntities(anthropic, content) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0,
      system: `Extract entities (people, places, organizations, projects) from the note.
Return ONLY valid JSON:
{
  "entities": [
    { "name": "string", "entity_type": "person|place|organization|project", "description": "brief context" }
  ]
}
If no entities found, return { "entities": [] }
DO NOT include any text before or after the JSON.`,
      messages: [
        { role: 'user', content: `Note: "${content}"` }
      ]
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '{"entities":[]}';

    try {
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
      if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
      if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);

      const parsed = JSON.parse(cleanText.trim());
      return parsed.entities || [];
    } catch {
      console.warn('[Background] Entity JSON parse failed:', text.substring(0, 100));
      return [];
    }
  } catch (error) {
    console.error('[Background] Entity extraction error:', error.message);
    return [];
  }
}

// ============================================
// BATCH EMBEDDINGS (One API call)
// ============================================

async function generateEmbeddingsBatch(texts) {
  if (texts.length === 0) return [];

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts
      })
    });

    if (!response.ok) {
      console.error('[Background] Embeddings API error:', response.status);
      return texts.map(() => null);
    }

    const data = await response.json();
    return data.data.map(d => d.embedding);
  } catch (error) {
    console.error('[Background] Embeddings error:', error.message);
    return texts.map(() => null);
  }
}

// ============================================
// SAVE ENTITIES WITH BOOST
// ============================================

async function saveEntitiesWithBoost(supabase, userId, entities, noteId) {
  for (const entity of entities) {
    try {
      // Check for existing entity (duplicate detection)
      const { data: existing } = await supabase
        .from('user_entities')
        .select('id, importance_score, mention_count, summary')
        .eq('user_id', userId)
        .ilike('name', entity.name)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        // Boost existing entity
        const currentScore = existing.importance_score || 0.5;
        const newScore = Math.min(1.0, currentScore + (1 - currentScore) * 0.3);

        await supabase
          .from('user_entities')
          .update({
            importance_score: newScore,
            mention_count: (existing.mention_count || 1) + 1,
            last_mentioned_at: new Date().toISOString(),
            summary: entity.description
              ? (existing.summary ? `${existing.summary}. ${entity.description}` : entity.description)
              : existing.summary
          })
          .eq('id', existing.id);

        console.log(`[Background] Boosted entity: ${entity.name} (${currentScore.toFixed(2)} → ${newScore.toFixed(2)})`);
      } else {
        // Insert new entity
        const validTypes = ['person', 'place', 'organization', 'project', 'concept'];
        const entityType = validTypes.includes(entity.entity_type) ? entity.entity_type : 'concept';

        await supabase
          .from('user_entities')
          .insert({
            user_id: userId,
            name: entity.name,
            entity_type: entityType,
            summary: entity.description,
            embedding: entity.embedding,
            importance_score: 0.5,
            importance: 'medium',
            mention_count: 1,
            first_mentioned_at: new Date().toISOString(),
            last_mentioned_at: new Date().toISOString(),
            status: 'active'
          });

        console.log(`[Background] Created entity: ${entity.name} (${entityType})`);
      }
    } catch (error) {
      console.error(`[Background] Entity save error for ${entity.name}:`, error.message);
    }
  }
}

// ============================================
// UPDATE CATEGORY SUMMARIES (Safe)
// ============================================

async function updateCategorySummariesSafe(supabase, anthropic, userId, entities) {
  // Group entities by category
  const byCategory = {};
  for (const entity of entities) {
    const category = classifyEntityCategory(entity);
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(entity);
  }

  // Update each category
  for (const [category, categoryEntities] of Object.entries(byCategory)) {
    try {
      // Fetch existing summary
      const { data: existing } = await supabase
        .from('category_summaries')
        .select('summary, entity_count')
        .eq('user_id', userId)
        .eq('category', category)
        .maybeSingle();

      // Generate updated summary
      const newSummary = await generateUpdatedSummary(
        anthropic,
        category,
        existing?.summary || '',
        categoryEntities
      );

      // Upsert
      await supabase
        .from('category_summaries')
        .upsert({
          user_id: userId,
          category,
          summary: newSummary,
          entity_count: (existing?.entity_count || 0) + categoryEntities.length,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,category'
        });

      console.log(`[Background] Updated category: ${category}`);

    } catch (error) {
      console.error(`[Background] Category ${category} update failed:`, error.message);
    }
  }
}

function classifyEntityCategory(entity) {
  const type = entity.entity_type?.toLowerCase() || '';
  const name = entity.name?.toLowerCase() || '';
  const desc = (entity.description || '').toLowerCase();
  const text = `${type} ${name} ${desc}`;

  if (type === 'person' || text.includes('friend') || text.includes('family') || text.includes('colleague')) {
    return 'relationships';
  }
  if (text.includes('work') || text.includes('job') || text.includes('company') || text.includes('team') || type === 'organization') {
    return 'work_life';
  }
  if (type === 'place' || text.includes('city') || text.includes('country') || text.includes('trip')) {
    return 'personal_life';
  }
  if (type === 'project' || text.includes('project') || text.includes('building') || text.includes('launch')) {
    return 'projects';
  }
  return 'general';
}

async function generateUpdatedSummary(anthropic, category, existingSummary, newEntities) {
  const entityInfo = newEntities
    .map(e => `- ${e.name} (${e.entity_type}): ${e.description || 'No description'}`)
    .join('\n');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.3,
      system: `You are updating a user profile summary. REWRITE (don't append) the summary to incorporate new information. If new info conflicts with existing, prefer the new info. Keep it concise (max 100 words). Write in third person about the user.`,
      messages: [
        {
          role: 'user',
          content: `Category: ${category}

Existing summary:
${existingSummary || 'No existing summary.'}

New information to incorporate:
${entityInfo}

Write the updated summary (max 100 words):`
        }
      ]
    });

    return message.content[0]?.type === 'text' ? message.content[0].text : existingSummary;
  } catch (error) {
    console.error('[Background] Summary generation error:', error.message);
    return existingSummary;
  }
}
