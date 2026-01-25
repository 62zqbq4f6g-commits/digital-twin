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
import { encryptForStorage, isValidKey } from './lib/encryption-edge.js';

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

    // Get encryption key from body or header (client sends via X-Encryption-Key header)
    const encryptionKey = body.encryptionKey || req.headers.get('X-Encryption-Key');

    // Validate encryption key if provided
    const hasValidEncryption = encryptionKey && isValidKey(encryptionKey);
    if (encryptionKey && !hasValidEncryption) {
      console.warn('[Analyze-Edge] Invalid encryption key provided');
    }

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

    // Initialize Supabase (use fallback for env var compatibility)
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(
      process.env.SUPABASE_URL,
      supabaseKey
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
    console.log(`[Analyze-Edge] Reflection result:`, JSON.stringify(reflection, null, 2));

    // Validate reflection has required fields
    const heard = reflection?.what_i_heard || reflection?.heard || 'Reflection captured.';
    const noticed = reflection?.what_i_noticed || reflection?.noticed || '';
    const question = reflection?.question || '';

    console.log(`[Analyze-Edge] Mapped - heard: ${heard?.substring(0, 50)}...`);
    console.log(`[Analyze-Edge] Mapped - noticed: ${noticed?.substring(0, 50)}...`);

    const criticalPathTime = Date.now() - startTime;
    console.log(`[Analyze-Edge] === CRITICAL PATH COMPLETE: ${criticalPathTime}ms ===`);

    // Step 3: Queue background work (user doesn't wait)
    if (ctx?.waitUntil) {
      ctx.waitUntil(
        processInBackground(supabase, anthropic, userId, noteId, content, hasValidEncryption ? encryptionKey : null).catch(err => {
          console.error('[Background] Error:', err.message);
        })
      );
    } else {
      // Fallback: fire and forget (not ideal but works)
      processInBackground(supabase, anthropic, userId, noteId, content, hasValidEncryption ? encryptionKey : null).catch(err => {
        console.error('[Background] Error:', err.message);
      });
    }

    // Extract actions from content
    const extractedActions = extractActionsFromContent(content);

    // Classify category
    const category = classifyNoteCategory(content);

    // Step 4: Return immediately with reflection
    // Format matches original analyze.js flat response expected by processAPIResponse
    return new Response(
      JSON.stringify({
        // Tiered response format (Phase 8.8)
        tier: 2,
        heard: heard,
        noticed: noticed,
        question: question,
        // Standard fields
        title: generateTitle(content),
        summary: heard,
        cleanedInput: content,
        category: category,
        type: 'observation',
        emotionalTone: 'neutral',
        confidence: 0.8,
        noteType: 'personal',
        // Extracted actions
        actions: extractedActions,
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
    return { memoryContext: '', onboardingData: null, keyPeople: [] };
  }

  try {
    // Parallel fetch: onboarding + category summaries + key people + top entities
    const [onboardingResult, summariesResult, keyPeopleResult, entitiesResult] = await Promise.all([
      supabase
        .from('onboarding_data')
        .select('name, life_seasons, mental_focus, seeded_people, depth_answer')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('category_summaries')
        .select('category, summary')
        .eq('user_id', userId),
      // Key people explicitly added by user (e.g., "Seri - my dog")
      supabase
        .from('user_key_people')
        .select('name, relationship')
        .eq('user_id', userId),
      // Top entities from previous notes (people, pets, projects)
      supabase
        .from('user_entities')
        .select('name, entity_type, summary')
        .eq('user_id', userId)
        .order('mention_count', { ascending: false })
        .limit(15)
    ]);

    const onboardingData = onboardingResult.data;
    const summaries = summariesResult.data || [];
    const keyPeople = keyPeopleResult.data || [];
    const entities = entitiesResult.data || [];

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
        contextParts.push(`People from onboarding: ${people}`);
      }
    }

    // Add KEY PEOPLE (explicitly added - highest priority)
    if (keyPeople.length > 0) {
      contextParts.push('\n⭐ KEY PEOPLE (User explicitly told you about these - ALWAYS recognize them):');
      for (const person of keyPeople) {
        contextParts.push(`- ${person.name}: ${person.relationship}`);
      }
    }

    // Add top entities from previous notes
    if (entities.length > 0) {
      const personEntities = entities.filter(e => e.entity_type === 'person');
      const otherEntities = entities.filter(e => e.entity_type !== 'person');

      if (personEntities.length > 0) {
        contextParts.push('\nPeople mentioned in previous notes:');
        for (const e of personEntities.slice(0, 8)) {
          contextParts.push(`- ${e.name}${e.summary ? `: ${e.summary}` : ''}`);
        }
      }

      if (otherEntities.length > 0) {
        contextParts.push('\nOther important topics/projects:');
        for (const e of otherEntities.slice(0, 5)) {
          contextParts.push(`- ${e.name} (${e.entity_type})${e.summary ? `: ${e.summary}` : ''}`);
        }
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
      onboardingData,
      keyPeople
    };

  } catch (error) {
    console.error('[Analyze-Edge] Memory context error:', error.message);
    return { memoryContext: '', onboardingData: null, keyPeople: [] };
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

KEY PEOPLE RULE (CRITICAL):
- Look at the "KEY PEOPLE" section above - these are people the user EXPLICITLY told you about
- If the note mentions ANY name from KEY PEOPLE, you ALREADY KNOW who they are
- Example: If "Seri" is listed as "my dog", and user writes "walked Seri today", your reflection should naturally acknowledge Seri as their dog
- NEVER ask "who is [name]?" if that name appears in KEY PEOPLE
- Acknowledge the relationship naturally: "You took Seri out for a walk — how's she doing?"

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
GOOD question: "What wellness activities do you think would resonate most with your team?"

BAD (ignoring key person): "You mentioned walking someone named Seri."
GOOD (recognizing key person): "You took Seri out for a walk — sounds like quality time with your dog."`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      temperature: 0.4,
      // System prompt with cache_control for prompt caching (~50% cost reduction on cache hits)
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        {
          role: 'user',
          content: `Here is my note:\n\n"${content}"\n\nReflect on this thoughtfully and specifically.`
        }
      ]
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}';
    console.log('[Analyze-Edge] Raw LLM response:', text.substring(0, 300));

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
      cleanText = cleanText.trim();

      const parsed = JSON.parse(cleanText);
      console.log('[Analyze-Edge] Parsed JSON keys:', Object.keys(parsed));
      return parsed;
    } catch (parseError) {
      // If JSON parse fails, create structured response from text
      console.warn('[Analyze-Edge] JSON parse failed:', parseError.message);
      console.warn('[Analyze-Edge] Raw text was:', text.substring(0, 200));
      return {
        what_i_heard: text.length > 0 ? text : 'I received your note.',
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
// ACTION EXTRACTION
// ============================================

const ACTION_PATTERNS = [
  /need to ([^.!?\n]+)/gi,
  /should ([^.!?\n]+)/gi,
  /must ([^.!?\n]+)/gi,
  /have to ([^.!?\n]+)/gi,
  /remember to ([^.!?\n]+)/gi,
  /don't forget (?:to )?([^.!?\n]+)/gi,
  /going to ([^.!?\n]+)/gi,
  /will ([^.!?\n]+)/gi,
  /reach out to ([^.!?\n]+)/gi,
  /follow up (?:with |on )?([^.!?\n]+)/gi,
  /schedule ([^.!?\n]+)/gi,
  /send ([^.!?\n]+)/gi,
  /call ([^.!?\n]+)/gi,
  /email ([^.!?\n]+)/gi,
  /contact ([^.!?\n]+)/gi
];

const NON_ACTIONABLE = [
  'stay ', 'be ', 'feel ', 'keep ', 'remain ',
  'relax', 'calm down', 'focus', 'sleep', 'rest',
  'think about it', 'remember that', 'believe'
];

function extractActionsFromContent(content) {
  if (!content) return [];

  const actions = [];
  const seen = new Set();
  const seenTexts = []; // Track full texts for substring checking

  for (const pattern of ACTION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let action = match[1]?.trim();
      if (!action || action.length < 5) continue;

      // Skip non-actionable items
      const lower = action.toLowerCase();
      if (NON_ACTIONABLE.some(na => lower.startsWith(na))) continue;

      // Clean up and capitalize
      action = action.charAt(0).toUpperCase() + action.slice(1);

      // Remove trailing punctuation
      action = action.replace(/[,;:]+$/, '').trim();

      const lowerAction = action.toLowerCase();

      // Skip if exact match already seen
      if (seen.has(lowerAction)) continue;

      // Skip if this is a substring of an existing action (e.g., "Nancy" when "Reach out to Nancy" exists)
      const isSubstring = seenTexts.some(existing => existing.includes(lowerAction));
      if (isSubstring) continue;

      // Remove any existing actions that are substrings of this new one
      // (e.g., if "Nancy" was added first, remove it when "Reach out to Nancy" comes)
      const subsToRemove = [];
      seenTexts.forEach((existing, idx) => {
        if (lowerAction.includes(existing)) {
          subsToRemove.push(idx);
        }
      });
      // Remove in reverse order to maintain indices
      for (let i = subsToRemove.length - 1; i >= 0; i--) {
        const idx = subsToRemove[i];
        seen.delete(seenTexts[idx]);
        seenTexts.splice(idx, 1);
        actions.splice(idx, 1);
      }

      seen.add(lowerAction);
      seenTexts.push(lowerAction);
      actions.push({
        action: action,  // Must be 'action' not 'text' for ActionsUI
        effort: 'medium',
        deadline: null,
        status: 'suggested',
        source: 'extracted'
      });
    }
  }

  return actions;
}

// ============================================
// CATEGORY CLASSIFICATION
// ============================================

function classifyNoteCategory(content) {
  const lower = content.toLowerCase();

  // Work indicators
  const workTerms = ['meeting', 'work', 'project', 'deadline', 'client', 'team', 'boss', 'colleague', 'office', 'presentation', 'proposal', 'contract', 'revenue', 'business', 'stakeholder'];
  const workCount = workTerms.filter(t => lower.includes(t)).length;

  // Personal/health indicators (all map to 'personal')
  const personalTerms = ['family', 'friend', 'home', 'weekend', 'vacation', 'hobby', 'birthday', 'anniversary', 'relationship', 'dating', 'love', 'health', 'sleep', 'exercise', 'doctor', 'sick', 'tired', 'stress', 'anxiety', 'therapy', 'meditation'];
  const personalCount = personalTerms.filter(t => lower.includes(t)).length;

  // Ideas/learning indicators
  const ideasTerms = ['idea', 'think', 'maybe', 'could', 'wonder', 'curious', 'learn', 'read', 'research', 'explore', 'experiment'];
  const ideasCount = ideasTerms.filter(t => lower.includes(t)).length;

  // Return category based on highest count
  if (workCount > personalCount && workCount > ideasCount) {
    return 'work';
  }
  if (ideasCount > personalCount && ideasCount > workCount) {
    return 'ideas';
  }
  // Default to personal (includes health)
  return 'personal';
}

// ============================================
// BACKGROUND PROCESSING (User doesn't wait)
// ============================================

async function processInBackground(supabase, anthropic, userId, noteId, content, encryptionKey = null) {
  const startTime = Date.now();
  console.log('[Background] === START ===');
  console.log('[Background] Encryption:', encryptionKey ? 'enabled' : 'disabled');

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

    // Step 3: Parallel - save entities + update summaries (with encryption if available)
    t0 = Date.now();
    await Promise.all([
      saveEntitiesWithBoost(supabase, userId, entities, noteId, encryptionKey),
      updateCategorySummariesSafe(supabase, anthropic, userId, entities, encryptionKey)
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

// Static system prompt for entity extraction (cacheable)
const ENTITY_EXTRACTION_SYSTEM_PROMPT = `Extract named entities from the note.

ENTITY TYPES:
- person: Named individuals with actual names (e.g., "Sarah", "Marcus Chen", "TestPerson Alpha")
- organization: Companies, institutions, teams (e.g., "Google", "Anthropic", "Microsoft")
- place: Locations, cities, countries (e.g., "Bangkok", "New York", "Phuket")
- project: Named projects or products (e.g., "Project Alpha", "Inscript")

CRITICAL RULES:
1. ONLY extract entities with specific names - not generic terms
2. DO NOT extract job titles alone (e.g., "Senior Engineer", "CEO", "Product Manager")
3. DO NOT extract generic roles without names
4. If "Senior Engineer at Google" appears, extract "Google" (organization) NOT "Senior Engineer" (person)
5. If a name appears with a job title, the person IS the name, the title goes in description

Return ONLY valid JSON:
{
  "entities": [
    { "name": "string", "entity_type": "person|place|organization|project", "description": "brief context including role/title" }
  ]
}

EXAMPLES:
Note: "Had coffee with Sarah, she's a Senior Engineer at Google"
Correct: [{"name": "Sarah", "entity_type": "person", "description": "Senior Engineer at Google"}, {"name": "Google", "entity_type": "organization", "description": "Sarah works here"}]
Wrong: [{"name": "Senior Engineer", "entity_type": "person", ...}]

If no named entities found, return { "entities": [] }
DO NOT include any text before or after the JSON.`;

async function extractEntities(anthropic, content) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0,
      // System prompt with cache_control for prompt caching
      system: [
        {
          type: 'text',
          text: ENTITY_EXTRACTION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
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

async function saveEntitiesWithBoost(supabase, userId, entities, noteId, encryptionKey = null) {
  for (const entity of entities) {
    try {
      // Check for existing entity (duplicate detection)
      const { data: existing } = await supabase
        .from('user_entities')
        .select('id, importance_score, mention_count, summary, encrypted_data')
        .eq('user_id', userId)
        .ilike('name', entity.name)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        // Boost existing entity
        const currentScore = existing.importance_score || 0.5;
        const newScore = Math.min(1.0, currentScore + (1 - currentScore) * 0.3);

        const newSummary = entity.description
          ? (existing.summary ? `${existing.summary}. ${entity.description}` : entity.description)
          : existing.summary;

        const updateData = {
          importance_score: newScore,
          mention_count: (existing.mention_count || 1) + 1,
          last_mentioned_at: new Date().toISOString()
        };

        // If encryption is enabled, encrypt sensitive fields
        if (encryptionKey) {
          const sensitiveData = {
            name: entity.name,
            entity_type: entity.entity_type,
            summary: newSummary
          };
          updateData.encrypted_data = await encryptForStorage(sensitiveData, encryptionKey);
          // Keep plaintext for backwards compatibility during transition
          updateData.summary = newSummary;
        } else {
          updateData.summary = newSummary;
        }

        await supabase
          .from('user_entities')
          .update(updateData)
          .eq('id', existing.id);

        console.log(`[Background] Boosted entity: ${entity.name} (${currentScore.toFixed(2)} → ${newScore.toFixed(2)})${encryptionKey ? ' [encrypted]' : ''}`);
      } else {
        // Insert new entity
        const validTypes = ['person', 'place', 'organization', 'project', 'concept'];
        const entityType = validTypes.includes(entity.entity_type) ? entity.entity_type : 'concept';

        const insertData = {
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
        };

        // If encryption is enabled, encrypt sensitive fields
        if (encryptionKey) {
          const sensitiveData = {
            name: entity.name,
            entity_type: entityType,
            summary: entity.description
          };
          insertData.encrypted_data = await encryptForStorage(sensitiveData, encryptionKey);
        }

        await supabase
          .from('user_entities')
          .insert(insertData);

        console.log(`[Background] Created entity: ${entity.name} (${entityType})${encryptionKey ? ' [encrypted]' : ''}`);
      }
    } catch (error) {
      console.error(`[Background] Entity save error for ${entity.name}:`, error.message);
    }
  }
}

// ============================================
// UPDATE CATEGORY SUMMARIES (Safe)
// ============================================

async function updateCategorySummariesSafe(supabase, anthropic, userId, entities, encryptionKey = null) {
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
        .select('summary, entity_count, encrypted_data')
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

      const upsertData = {
        user_id: userId,
        category,
        summary: newSummary,
        entity_count: (existing?.entity_count || 0) + categoryEntities.length,
        updated_at: new Date().toISOString()
      };

      // If encryption is enabled, encrypt sensitive fields
      if (encryptionKey) {
        const sensitiveData = {
          summary: newSummary,
          themes: categoryEntities.map(e => e.name)
        };
        upsertData.encrypted_data = await encryptForStorage(sensitiveData, encryptionKey);
      }

      // Upsert
      await supabase
        .from('category_summaries')
        .upsert(upsertData, {
          onConflict: 'user_id,category'
        });

      console.log(`[Background] Updated category: ${category}${encryptionKey ? ' [encrypted]' : ''}`);

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

// Static system prompt for summary generation (cacheable)
const SUMMARY_GENERATION_SYSTEM_PROMPT = `You are updating a user profile summary. REWRITE (don't append) the summary to incorporate new information. If new info conflicts with existing, prefer the new info. Keep it concise (max 100 words). Write in third person about the user.`;

async function generateUpdatedSummary(anthropic, category, existingSummary, newEntities) {
  const entityInfo = newEntities
    .map(e => `- ${e.name} (${e.entity_type}): ${e.description || 'No description'}`)
    .join('\n');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.3,
      // System prompt with cache_control for prompt caching
      system: [
        {
          type: 'text',
          text: SUMMARY_GENERATION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
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
