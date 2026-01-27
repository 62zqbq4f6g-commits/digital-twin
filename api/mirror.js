/**
 * /api/mirror - Phase 13B: MIRROR Conversation API
 *
 * Endpoints:
 * POST /api/mirror?action=open - Initialize/resume conversation
 * POST /api/mirror?action=message - Send message, get response
 * POST /api/mirror?action=close - Archive conversation
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const { getUserFullContext, buildContextBlock, formatTone } = require('./user-context.js');

// Research and Knowledge modules
const { detectResearchMode, conductResearch, buildResearchPrompt, formatResearchForContextUI } = require('../lib/mirror/research-mode.js');
const { detectKnowledgeQuery, getKnowledgeAbout, buildKnowledgePrompt, formatKnowledgeForContextUI } = require('../lib/mirror/knowledge-about.js');
// SPRINT 3: Fact retrieval with message-based entity detection
const { getRelevantFacts } = require('../lib/mirror/fact-retrieval.js');
// Contradiction detection for evolution awareness
const { getContradictionsForEntity, formatForContext: formatContradictionsForContext } = require('../lib/contradiction-detection.js');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Minimum notes required for full MIRROR experience
const MIN_NOTES_FOR_INSIGHTS = 5;

/**
 * SPRINT 3: Fetch structured facts for entities
 * Facts provide specific knowledge (works_at, role, likes, etc.)
 */
async function getFactsForEntities(user_id, entityIds) {
  if (!entityIds?.length) return [];

  const { data: facts, error } = await supabase
    .from('entity_facts')
    .select('entity_id, predicate, object_text, confidence')
    .eq('user_id', user_id)
    .in('entity_id', entityIds)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[mirror] Failed to fetch facts:', error.message);
    return [];
  }

  return facts || [];
}

/**
 * Format facts for natural inclusion in prompt
 * Groups facts by entity and formats naturally
 */
function formatFactsForPrompt(entities, facts) {
  if (!facts?.length) return null;

  // Create entity ID to name map
  const entityMap = new Map(entities.map(e => [e.id, e]));

  // Group facts by entity
  const factsByEntity = {};
  for (const fact of facts) {
    const entity = entityMap.get(fact.entity_id);
    if (!entity) continue;

    if (!factsByEntity[entity.name]) {
      factsByEntity[entity.name] = { entity, facts: [] };
    }
    factsByEntity[entity.name].facts.push(fact);
  }

  // Format each entity's facts
  const formatted = Object.entries(factsByEntity).map(([name, data]) => {
    const factLines = data.facts.slice(0, 5).map(f => {
      // Format predicate naturally
      const predicate = f.predicate.replace(/_/g, ' ');
      return `  - ${predicate}: ${f.object_text}`;
    }).join('\n');

    return `${name}:\n${factLines}`;
  });

  return formatted.length > 0 ? formatted.join('\n\n') : null;
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action || req.body?.action;
  const user_id = req.body?.user_id;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    switch (action) {
      case 'open':
        return await handleOpen(req, res, user_id);
      case 'message':
        return await handleMessage(req, res, user_id);
      case 'close':
        return await handleClose(req, res, user_id);
      default:
        return res.status(400).json({ error: 'Invalid action. Use: open, message, close' });
    }
  } catch (error) {
    console.error('[mirror] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Open/resume MIRROR conversation
 */
async function handleOpen(req, res, user_id) {
  // Extract client-provided context (decrypted on client side)
  const clientContext = req.body?.clientContext;
  const hasClientContext = !!(clientContext?.contextBlock || clientContext?.memory?.entities?.length > 0);

  console.log('[mirror] handleOpen - hasClientContext:', hasClientContext);

  // Check note count for experience level
  const { count: noteCount } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('deleted_at', null);

  // Check for existing active conversation
  const { data: existingConvo } = await supabase
    .from('mirror_conversations')
    .select('*, mirror_messages(*)')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  if (existingConvo) {
    // Resume existing conversation
    const messages = existingConvo.mirror_messages || [];
    const opening = await generateContinuityOpening(user_id, existingConvo);

    // Use client context if provided, otherwise fetch from server
    const hasContext = hasClientContext || (await getUserContext(user_id)).hasContext;

    return res.status(200).json({
      conversationId: existingConvo.id,
      isNewConversation: false,
      noteCount,
      opening,
      hasContext,
      previousMessages: messages.map(formatMessage)
    });
  }

  // Get user context to determine hasContext - prefer client context
  const hasContext = hasClientContext || (await getUserContext(user_id)).hasContext;

  // Create new conversation
  const opening = await generateOpening(user_id, noteCount, hasContext);

  const { data: newConvo, error: createError } = await supabase
    .from('mirror_conversations')
    .insert({
      user_id,
      status: 'active',
      opening_type: opening.type,
      opening_signal: opening.signal || null
    })
    .select()
    .single();

  if (createError) {
    console.error('[mirror] Error creating conversation:', createError);
    return res.status(500).json({ error: 'Failed to create conversation' });
  }

  // Store Inscript's opening message
  await supabase
    .from('mirror_messages')
    .insert({
      conversation_id: newConvo.id,
      user_id,
      role: 'inscript',
      content: opening.message,
      message_type: 'prompt'
    });

  return res.status(200).json({
    conversationId: newConvo.id,
    isNewConversation: true,
    noteCount,
    opening,
    hasContext,
    previousMessages: []
  });
}

/**
 * Handle user message and generate response
 */
async function handleMessage(req, res, user_id) {
  const { conversation_id, message, context, clientContext, recentSessionNotes } = req.body;

  if (!conversation_id || !message) {
    return res.status(400).json({ error: 'conversation_id and message required' });
  }

  // Log client context if present (for debugging)
  const hasClientContext = !!(clientContext?.contextBlock || clientContext?.memory?.entities?.length > 0);
  console.log('[mirror] handleMessage - hasClientContext:', hasClientContext);
  if (hasClientContext) {
    console.log('[mirror] Client context entities:', clientContext?.memory?.entities?.length || 0);
    console.log('[mirror] Client context patterns:', clientContext?.memory?.patterns?.length || 0);
  }

  // Log session notes if present (for debugging)
  if (recentSessionNotes?.length > 0) {
    console.log('[mirror] Received', recentSessionNotes.length, 'session notes from client');
  }

  // Verify conversation belongs to user
  const { data: conversation, error: convoError } = await supabase
    .from('mirror_conversations')
    .select('*')
    .eq('id', conversation_id)
    .eq('user_id', user_id)
    .single();

  if (convoError || !conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Store user message
  const { data: userMsg } = await supabase
    .from('mirror_messages')
    .insert({
      conversation_id,
      user_id,
      role: 'user',
      content: message,
      message_type: 'response'
    })
    .select()
    .single();

  // Get conversation history
  const { data: history } = await supabase
    .from('mirror_messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true });

  // Build user context - prefer client-provided decrypted context
  let userContext;
  if (hasClientContext) {
    // Use client-decrypted context
    userContext = buildContextFromClient(clientContext);
    console.log('[mirror] Using client-provided decrypted context');
  } else {
    // Fallback to server-side fetch (for backwards compatibility)
    userContext = await getUserContext(user_id);
    console.log('[mirror] Using server-fetched context');
  }

  // Add session notes to context (client-side notes not yet in server DB)
  userContext.recentSessionNotes = recentSessionNotes || [];

  // Check for special modes: Research and Knowledge queries
  let response;
  let specialMode = null;

  // Check for Research mode (deep dive into topics)
  const researchCheck = detectResearchMode(message);
  if (researchCheck.isResearch) {
    console.log('[mirror] Research mode detected for topic:', researchCheck.topic);
    specialMode = 'research';

    // Conduct research
    const research = await conductResearch(user_id, researchCheck.topic, supabase);
    const researchPrompt = buildResearchPrompt(research);
    const researchContextUI = formatResearchForContextUI(research);

    // Generate response with research context
    response = await generateResponse(user_id, message, history || [], {
      ...userContext,
      researchContext: researchPrompt,
      researchResults: research
    }, context);

    // Add research stats to context used
    response.contextUsed = [...researchContextUI, ...(response.contextUsed || [])];
    response.researchSummary = {
      topic: research.topic,
      noteCount: research.noteCount,
      entityCount: research.entities.length,
      patternCount: research.patterns.length,
      relatedPeople: research.relatedPeople
    };
  }
  // Check for Knowledge query ("what do you know about X")
  else {
    const knowledgeCheck = detectKnowledgeQuery(message);
    if (knowledgeCheck.isKnowledgeQuery) {
      console.log('[mirror] Knowledge query detected for subject:', knowledgeCheck.subject);
      specialMode = 'knowledge';

      // Get knowledge about subject
      const knowledge = await getKnowledgeAbout(user_id, knowledgeCheck.subject, supabase);
      const knowledgePrompt = buildKnowledgePrompt(knowledge);
      const knowledgeContextUI = formatKnowledgeForContextUI(knowledge);

      // Generate response with knowledge context
      response = await generateResponse(user_id, message, history || [], {
        ...userContext,
        knowledgeContext: knowledgePrompt,
        knowledgeResults: knowledge
      }, context);

      // Add knowledge to context used
      response.contextUsed = [...knowledgeContextUI, ...(response.contextUsed || [])];
    }
    // Normal response generation
    else {
      response = await generateResponse(user_id, message, history || [], userContext, context);
    }
  }

  // Store Inscript response
  const { data: inscriptMsg } = await supabase
    .from('mirror_messages')
    .insert({
      conversation_id,
      user_id,
      role: 'inscript',
      content: response.content,
      message_type: response.type || 'response',
      referenced_notes: response.referencedNotes || null,
      referenced_entities: response.referencedEntities || null
    })
    .select()
    .single();

  // Update conversation timestamp
  await supabase
    .from('mirror_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation_id);

  // Determine conversation mode for UI indicator
  let conversationMode = null;
  if (response.type === 'thinking_partner') conversationMode = 'thinking';
  else if (specialMode === 'research') conversationMode = 'research';
  else if (specialMode === 'knowledge') conversationMode = 'knowledge';

  return res.status(200).json({
    messageId: inscriptMsg.id,
    response: {
      content: response.content,
      insightType: response.type,
      referencedNotes: response.referencedNotes,
      conversationMode, // 'thinking' | 'research' | 'knowledge' | null — for UI indicator
      contextUsed: response.contextUsed || [], // For Context Used UI
      researchSummary: response.researchSummary || null // For Research mode UI
    }
  });
}

/**
 * Close/archive conversation
 */
async function handleClose(req, res, user_id) {
  const { conversation_id } = req.body;

  if (!conversation_id) {
    return res.status(400).json({ error: 'conversation_id required' });
  }

  // Generate summary of conversation
  const { data: messages } = await supabase
    .from('mirror_messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true });

  let summary = null;
  if (messages && messages.length > 2) {
    summary = await generateConversationSummary(messages);
  }

  // Update conversation status
  const { error: updateError } = await supabase
    .from('mirror_conversations')
    .update({
      status: 'archived',
      summary
    })
    .eq('id', conversation_id)
    .eq('user_id', user_id);

  if (updateError) {
    return res.status(500).json({ error: 'Failed to close conversation' });
  }

  return res.status(200).json({
    success: true,
    summary
  });
}

/**
 * Generate opening message based on user state and signals
 */
async function generateOpening(user_id, noteCount, hasContext = true) {
  // No context at all - minimal personalization fallback
  if (!hasContext) {
    return {
      type: 'presence',
      message: "I'm still getting to know you. What's on your mind?",
      promptButtons: null
    };
  }

  // New user - gentle welcome
  if (noteCount < MIN_NOTES_FOR_INSIGHTS) {
    return {
      type: 'presence',
      message: "I'm still getting to know you. The more you share in Notes, the richer our conversations will become. But I'm here whenever you want to talk.",
      promptButtons: null
    };
  }

  // Check for signals (recent activity patterns)
  const signal = await findBestSignal(user_id);

  if (signal) {
    return {
      type: 'signal',
      message: signal.message,
      promptButtons: signal.buttons,
      signal: signal.data
    };
  }

  // No strong signal - gentle presence
  return {
    type: 'presence',
    message: "I'm here. What would you like to explore?",
    promptButtons: null
  };
}

/**
 * Generate continuity opening for returning user
 */
async function generateContinuityOpening(user_id, conversation) {
  const { data: lastMessage } = await supabase
    .from('mirror_messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastMessage && lastMessage.role === 'inscript') {
    // Last message was Inscript asking something
    return {
      type: 'continuity',
      message: null, // Don't repeat, just show history
      promptButtons: null
    };
  }

  return {
    type: 'continuity',
    message: "We were in the middle of something. Want to continue?",
    promptButtons: [
      { label: "Yes, continue", action: "continue" },
      { label: "Start fresh", action: "fresh" }
    ]
  };
}

/**
 * Find best signal to open conversation with
 * Note: Notes are E2E encrypted, so we use entities for signal detection
 * Priority order:
 * 1. Recency + Frequency (entity mentioned 3+ times)
 * 2. Pattern Confirmation (unverified pattern above 80%)
 * 3. Time-based Continuity (last conversation left thread open)
 * 4. Milestone (10th note, 30 days of use, etc.)
 * 5. Gentle Presence (no strong signal)
 */
async function findBestSignal(user_id) {
  // Get entities with high mention counts for frequency signals
  const { data: entities } = await supabase
    .from('user_entities')
    .select('name, entity_type, mention_count, context_notes, updated_at')
    .eq('user_id', user_id)
    .gte('mention_count', 3)
    .order('mention_count', { ascending: false })
    .limit(5);

  // Get recent note count
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentNoteCount } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('created_at', sevenDaysAgo);

  // PRIORITY 1: Recency + Frequency (entity mentioned 3+ times)
  const frequencySignal = checkFrequencySignal(entities);
  if (frequencySignal) return frequencySignal;

  // PRIORITY 2: Pattern Confirmation
  const patternSignal = await checkPatternSignal(user_id);
  if (patternSignal) return patternSignal;

  // PRIORITY 3: Time-based Continuity
  const continuitySignal = await checkContinuitySignal(user_id);
  if (continuitySignal) return continuitySignal;

  // PRIORITY 4: Milestone
  const milestoneSignal = await checkMilestoneSignal(user_id, recentNoteCount || 0);
  if (milestoneSignal) return milestoneSignal;

  // No strong signal
  return null;
}

/**
 * Check for frequency-based signal (entity mentioned 3+ times)
 * Uses extracted entities since notes are E2E encrypted
 */
function checkFrequencySignal(entities) {
  if (!entities || entities.length === 0) return null;

  // Find the most frequently mentioned entity
  const topEntity = entities[0]; // Already sorted by mention_count DESC

  if (topEntity && topEntity.mention_count >= 3) {
    return {
      message: `${topEntity.name} has come up ${topEntity.mention_count} times recently. There seems to be something on your mind. Want to explore it?`,
      buttons: [
        { label: "Let's explore", action: "explore" },
        { label: "Not now", action: "dismiss" }
      ],
      data: { type: 'frequency', entity: topEntity.name, count: topEntity.mention_count }
    };
  }

  return null;
}

/**
 * Check for emotional signals
 * Note: Notes are E2E encrypted, so emotional detection is not currently available
 * Future: Could detect emotions from entity context_notes if we extract sentiment
 */
function checkEmotionalSignal() {
  // Not implemented - notes are E2E encrypted and we can't read content server-side
  return null;
}

/**
 * Check for unverified patterns above 80% confidence
 */
async function checkPatternSignal(user_id) {
  const { data: patterns } = await supabase
    .from('user_patterns')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', 'detected')
    .gte('confidence', 0.8)
    .order('confidence', { ascending: false })
    .limit(1);

  if (patterns && patterns.length > 0) {
    const pattern = patterns[0];
    return {
      message: `I've been noticing something: ${pattern.short_description}. Does that feel right to you?`,
      buttons: [
        { label: "That resonates", action: "confirm_pattern", patternId: pattern.id },
        { label: "Not quite", action: "reject_pattern", patternId: pattern.id }
      ],
      data: { type: 'pattern', patternId: pattern.id }
    };
  }

  return null;
}

/**
 * Check for conversation continuity signal
 */
async function checkContinuitySignal(user_id) {
  // Look for archived conversations with open threads
  const { data: lastConvo } = await supabase
    .from('mirror_conversations')
    .select('id, summary, key_insights, thread_context')
    .eq('user_id', user_id)
    .eq('status', 'archived')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  if (lastConvo?.thread_context?.openThread) {
    const thread = lastConvo.thread_context.openThread;
    return {
      message: `Last time, you were thinking about ${thread.topic}. Did you figure it out?`,
      buttons: [
        { label: "Let's continue", action: "continue" },
        { label: "Start fresh", action: "fresh" }
      ],
      data: { type: 'continuity', conversationId: lastConvo.id, topic: thread.topic }
    };
  }

  return null;
}

/**
 * Check for milestone signals
 */
async function checkMilestoneSignal(user_id, recentNoteCount) {
  // Get total note count
  const { count: totalNotes } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('deleted_at', null);

  // Get user's first note date
  const { data: firstNote } = await supabase
    .from('notes')
    .select('created_at')
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  const daysSinceFirst = firstNote
    ? Math.floor((Date.now() - new Date(firstNote.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Check milestones
  const milestones = [
    { notes: 10, message: "You've shared 10 thoughts with me now. I'm starting to see the shape of your world." },
    { notes: 25, message: "25 notes. Your story is taking shape. I've noticed some themes worth exploring." },
    { notes: 50, message: "50 notes. We've built something together. Want to look back at how far you've come?" },
    { notes: 100, message: "100 notes. That's remarkable. Your commitment to self-reflection is rare. Let's celebrate what you've learned." }
  ];

  const dayMilestones = [
    { days: 7, message: "It's been a week of sharing. How's this practice feeling for you?" },
    { days: 30, message: "We've been at this a month now. That's real commitment. What's different?" },
    { days: 90, message: "Three months. You've built a habit of reflection. What has it taught you?" }
  ];

  // Check note milestones (exact match to avoid repeating)
  for (const m of milestones) {
    if (totalNotes === m.notes) {
      return {
        message: m.message,
        buttons: [
          { label: "Tell me more", action: "explore" },
          { label: "Maybe later", action: "dismiss" }
        ],
        data: { type: 'milestone', milestone: `${m.notes}_notes` }
      };
    }
  }

  // Check day milestones (within 1 day to avoid missing)
  for (const m of dayMilestones) {
    if (daysSinceFirst >= m.days && daysSinceFirst <= m.days + 1) {
      return {
        message: m.message,
        buttons: [
          { label: "Let's reflect", action: "explore" },
          { label: "Not now", action: "dismiss" }
        ],
        data: { type: 'milestone', milestone: `${m.days}_days` }
      };
    }
  }

  return null;
}

/**
 * MEM0 BUILD 7: Build type-aware context for MIRROR conversations
 * Uses enhanced search with memory types for richer context
 */
async function buildMirrorContext(user_id, query = '') {
  try {
    // Check if we have a query to generate embedding for
    let embedding = null;
    if (query && query.length > 10) {
      try {
        const embResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query
          })
        });
        const embData = await embResponse.json();
        embedding = embData.data?.[0]?.embedding;
      } catch (e) {
        console.log('[mirror] Embedding generation failed, using fallback:', e.message);
      }
    }

    // Get user preferences
    const { data: prefs } = await supabase
      .from('memory_preferences')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    // Detect if query asks about history/past
    const includeHistorical = query && /used to|previously|in the past|history|changed/i.test(query);

    let memories = [];

    // Try enhanced search if we have embedding
    if (embedding) {
      const { data: searchResults } = await supabase.rpc('match_entities_enhanced', {
        query_embedding: embedding,
        match_threshold: 0.35,
        match_count: 20,
        p_user_id: user_id,
        p_include_historical: includeHistorical,
        p_exclude_expired: true,
        p_sensitivity_max: prefs?.default_sensitivity_level || 'normal'
      });
      memories = searchResults || [];
    }

    // Fallback: get recent entities if no embedding search
    if (!memories.length) {
      const { data: fallbackEntities } = await supabase
        .from('user_entities')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(20);
      memories = fallbackEntities || [];
    }

    if (!memories.length) {
      return { context: '', memories: [], stats: { total: 0 } };
    }

    // Prioritize by type for better context
    const prioritized = {
      preferences: memories.filter(m => m.memory_type === 'preference'),
      goals: memories.filter(m => m.memory_type === 'goal' && !m.is_historical),
      facts: memories.filter(m => m.memory_type === 'fact'),
      entities: memories.filter(m => m.memory_type === 'entity' || !m.memory_type),
      events: memories.filter(m => m.memory_type === 'event'),
      decisions: memories.filter(m => m.memory_type === 'decision'),
      historical: memories.filter(m => m.is_historical)
    };

    // Build context sections
    let context = '';

    if (prioritized.preferences.length) {
      context += `\n<user_preferences>\n`;
      prioritized.preferences.forEach(p => {
        context += `- ${p.summary || p.name}\n`;
      });
      context += `</user_preferences>\n`;
    }

    if (prioritized.goals.length) {
      context += `\n<active_goals>\n`;
      prioritized.goals.forEach(g => {
        const deadline = g.expires_at ? ` (deadline: ${new Date(g.expires_at).toLocaleDateString()})` : '';
        context += `- ${g.summary || g.name}${deadline}\n`;
      });
      context += `</active_goals>\n`;
    }

    if (prioritized.entities.length) {
      context += `\n<relevant_context>\n`;
      prioritized.entities.forEach(e => {
        const sentiment = (e.sentiment_average || 0) > 0.3 ? '(positive)' :
                         (e.sentiment_average || 0) < -0.3 ? '(negative)' : '';
        context += `- ${e.name}: ${e.summary || e.relationship || 'known'} ${sentiment}\n`;
      });
      context += `</relevant_context>\n`;
    }

    if (prioritized.facts.length) {
      context += `\n<known_facts>\n`;
      prioritized.facts.forEach(f => {
        context += `- ${f.summary || f.name}\n`;
      });
      context += `</known_facts>\n`;
    }

    if (prioritized.events.length) {
      context += `\n<upcoming_events>\n`;
      prioritized.events.forEach(e => {
        const dateStr = e.effective_from ? new Date(e.effective_from).toLocaleDateString() : '';
        context += `- ${e.summary || e.name}${dateStr ? ` (${dateStr})` : ''}\n`;
      });
      context += `</upcoming_events>\n`;
    }

    if (includeHistorical && prioritized.historical.length) {
      context += `\n<historical_context>\n`;
      prioritized.historical.forEach(h => {
        context += `- Previously: ${h.summary || h.name}\n`;
      });
      context += `</historical_context>\n`;
    }

    // Get related entities via graph if main entity detected
    const mainEntity = memories.find(m => m.entity_type === 'person' && (m.similarity || 0) > 0.6);
    if (mainEntity) {
      try {
        const { data: connections } = await supabase.rpc('traverse_entity_graph', {
          p_entity_id: mainEntity.id,
          p_user_id: user_id,
          p_max_depth: 1,
          p_min_strength: 0.4
        });

        if (connections?.length) {
          context += `\n<related_context>\n`;
          context += `${mainEntity.name}'s connections:\n`;
          connections.forEach(c => {
            context += `- ${(c.relationship_types || []).join(' → ')} ${c.entity_name}\n`;
          });
          context += `</related_context>\n`;
        }
      } catch (e) {
        console.log('[mirror] Graph traversal not available:', e.message);
      }
    }

    return {
      context,
      memories: memories.map(m => m.id),
      stats: {
        total: memories.length,
        by_type: Object.fromEntries(
          Object.entries(prioritized).map(([k, v]) => [k, v.length]).filter(([, v]) => v > 0)
        )
      }
    };
  } catch (error) {
    console.error('[mirror] buildMirrorContext error:', error);
    return { context: '', memories: [], stats: { total: 0 } };
  }
}

/**
 * Build context from client-provided decrypted data
 * This replaces server-side fetching when client sends decrypted context
 */
function buildContextFromClient(clientContext) {
  const memory = clientContext?.memory || {};
  const profile = clientContext?.profile || {};

  // Build entities list from client data
  let allPeople = [];

  // Add Key People first (highest priority)
  if (memory.keyPeople?.length > 0) {
    for (const person of memory.keyPeople) {
      allPeople.push({
        name: person.name,
        entity_type: 'person',
        relationship: person.relationship || 'key person',
        context_notes: null,
        is_key_person: true
      });
    }
  }

  // Add seeded people from profile
  if (profile.seeded_people?.length > 0) {
    for (const person of profile.seeded_people) {
      const exists = allPeople.some(e =>
        e.name?.toLowerCase() === person.name?.toLowerCase()
      );
      if (!exists && person.name) {
        allPeople.push({
          name: person.name,
          entity_type: 'person',
          relationship: person.context || person.relationship || 'known person',
          is_seeded_person: true
        });
      }
    }
  }

  // Add entities
  for (const entity of (memory.entities || [])) {
    const exists = allPeople.some(e =>
      e.name?.toLowerCase() === entity.name?.toLowerCase()
    );
    if (!exists) {
      allPeople.push(entity);
    }
  }

  return {
    noteCount: 0, // We don't have this from client context
    entities: allPeople,
    patterns: memory.patterns || [],
    userName: profile.name || 'there',
    hasContext: true,

    onboarding: {
      name: profile.name,
      lifeSeasons: profile.life_seasons || [],
      focus: profile.mental_focus || [],
      people: profile.seeded_people || []
    },

    profile: {
      roleTypes: profile.role_types || [],
      goals: profile.goals || [],
      tone: profile.tone || null,
      lifeContext: profile.life_context || null,
      boundaries: profile.boundaries || []
    },

    depthQuestion: profile.depth_question || null,
    depthAnswer: profile.depth_answer || null,

    summaries: memory.summaries || [],

    // Include raw context block from client
    clientContextBlock: clientContext?.contextBlock || ''
  };
}

/**
 * Get user context for response generation
 */
async function getUserContext(user_id) {
  console.log('[mirror] Fetching FULL context for user via unified utility:', user_id);

  // Use the unified context fetcher that gets ALL user data
  const fullContext = await getUserFullContext(supabase, user_id);

  // Build merged entities list with priority: Key People > Seeded > Extracted
  let allPeople = [];

  // Add Key People first (highest priority - user explicitly added these)
  if (fullContext.keyPeople?.length > 0) {
    for (const person of fullContext.keyPeople) {
      allPeople.push({
        name: person.name,
        entity_type: 'person',
        relationship: person.relationship || 'key person',
        context_notes: null,
        is_key_person: true
      });
    }
  }

  // Add onboarding seeded people
  if (fullContext.seededPeople?.length > 0) {
    for (const person of fullContext.seededPeople) {
      const exists = allPeople.some(e =>
        e.name?.toLowerCase() === person.name?.toLowerCase()
      );
      if (!exists && person.name) {
        allPeople.push({
          name: person.name,
          entity_type: 'person',
          relationship: person.context || person.relationship || 'known person',
          is_seeded_person: true
        });
      }
    }
  }

  // Add entities that aren't already in the list
  for (const entity of (fullContext.entities || [])) {
    const exists = allPeople.some(e =>
      e.name?.toLowerCase() === entity.name?.toLowerCase()
    );
    if (!exists) {
      allPeople.push(entity);
    }
  }

  // Return context in format expected by existing code, plus new fields
  const contextResult = {
    noteCount: fullContext.noteCount,
    entities: allPeople,
    patterns: fullContext.patterns,
    userName: fullContext.userName,
    hasContext: fullContext.hasContext,

    // NEW: Full context from unified fetcher
    fullContext: fullContext,

    // Legacy onboarding format for backward compatibility
    onboarding: {
      name: fullContext.userName,
      lifeSeasons: fullContext.lifeSeasons,
      focus: fullContext.mentalFocus,
      people: fullContext.seededPeople
    },

    // NEW: Profile preferences (was completely missing before!)
    profile: {
      roleTypes: fullContext.roleTypes,
      goals: fullContext.goals,
      tone: fullContext.tone,
      lifeContext: fullContext.lifeContext,
      boundaries: fullContext.boundaries
    },

    // NEW: Depth question/answer from onboarding
    depthQuestion: fullContext.depthQuestion,
    depthAnswer: fullContext.depthAnswer,

    // NEW: Category summaries
    summaries: fullContext.summaries
  };

  console.log('[mirror] Full context loaded:', {
    noteCount: contextResult.noteCount,
    entitiesCount: contextResult.entities.length,
    patternsCount: contextResult.patterns.length,
    userName: contextResult.userName,
    hasLifeContext: !!contextResult.profile.lifeContext,
    hasGoals: contextResult.profile.goals?.length > 0,
    hasTone: !!contextResult.profile.tone,
    hasBoundaries: contextResult.profile.boundaries?.length > 0,
    hasDepthAnswer: !!contextResult.depthAnswer,
    summariesCount: contextResult.summaries?.length || 0
  });

  return contextResult;
}

/**
 * Generate Inscript response using Claude
 * Implements 5 insight types: Connection, Pattern, Reflection prompt, Reframe, Summary
 * MEM0 BUILD 7: Enhanced with type-aware context
 */
async function generateResponse(user_id, userMessage, history, context, additionalContext) {
  // MEM0 BUILD 7: Get type-aware context based on user's message
  const mirrorContext = await buildMirrorContext(user_id, userMessage);

  // SPRINT 3: Fetch structured facts with MESSAGE-BASED entity detection
  // This detects entity names mentioned in the current message and recent history
  const recentMessages = history.slice(-5).map(h => ({ content: h.content || h.message || '' }));
  const { facts: relevantFacts, entities: relevantEntities, factsByEntity } = await getRelevantFacts(user_id, userMessage, recentMessages);

  // Format facts for prompt - use the factsByEntity structure for natural formatting
  let factsContext = null;
  if (Object.keys(factsByEntity).length > 0) {
    factsContext = Object.entries(factsByEntity).map(([name, data]) => {
      const factLines = data.facts.slice(0, 5).map(f => `  - ${f.predicate.replace(/_/g, ' ')}: ${f.object}`).join('\n');
      return `${name}:\n${factLines}`;
    }).join('\n\n');
  }

  console.log('[mirror] Facts loaded:', relevantFacts.length, 'facts for', relevantEntities.length, 'entities (message-based detection)');

  // Fetch contradictions/evolutions for detected entities
  let evolutionsContext = null;
  if (relevantEntities.length > 0) {
    try {
      // Get contradictions for the first mentioned entity (most relevant)
      const primaryEntity = relevantEntities[0];
      const contradictions = await getContradictionsForEntity(user_id, primaryEntity.name);
      evolutionsContext = formatContradictionsForContext({
        contradictions: contradictions.contradictions,
        sentimentShifts: contradictions.evolutions,
        evolutions: []
      });
      if (evolutionsContext) {
        console.log('[mirror] Evolutions found for', primaryEntity.name);
      }
    } catch (err) {
      console.warn('[mirror] Contradiction detection failed:', err.message);
    }
  }

  // Merge enhanced context with existing context + facts + evolutions
  const enhancedContext = {
    ...context,
    mem0Context: mirrorContext.context,
    mem0Stats: mirrorContext.stats,
    entityFacts: factsContext,  // SPRINT 3: Structured facts
    evolutionsContext  // Contradiction/evolution awareness
  };

  // Analyze the conversation to determine best insight type
  const insightType = analyzeForInsightType(userMessage, history, enhancedContext);
  const systemPrompt = buildSystemPrompt(enhancedContext, insightType);
  const messages = buildConversationMessages(history, userMessage);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.7,
      // System prompt with cache_control for prompt caching (~50% cost reduction on cache hits)
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages
    });

    const content = response.content[0].text;

    // Find referenced entities mentioned in response
    const referencedEntities = findReferencedEntities(content, context.entities);

    // Build context used list for transparency (Feature 4: Context Used UI)
    const contextUsed = [];

    // Add entities to context used
    if (context.entities?.length > 0) {
      context.entities.slice(0, 3).forEach(e => {
        if (e.is_key_person) {
          contextUsed.push({
            type: 'key_person',
            name: e.name,
            value: e.relationship || 'key person'
          });
        } else {
          contextUsed.push({
            type: 'entity',
            name: e.name,
            value: `${e.entity_type || 'person'}, mentioned ${e.mention_count || 1}x`
          });
        }
      });
    }

    // Add facts to context used (SPRINT 3: using relevantFacts from message detection)
    if (relevantFacts?.length > 0) {
      relevantFacts.slice(0, 3).forEach(f => {
        contextUsed.push({
          type: 'fact',
          value: `${f.predicate.replace(/_/g, ' ')}: ${f.object_text}`
        });
      });
    }

    // Add patterns to context used
    if (context.patterns?.length > 0) {
      context.patterns.slice(0, 2).forEach(p => {
        contextUsed.push({
          type: 'pattern',
          value: p.short_description || p.description
        });
      });
    }

    // Add session notes to context used
    if (context.recentSessionNotes?.length > 0) {
      context.recentSessionNotes.slice(0, 2).forEach(n => {
        contextUsed.push({
          type: 'note',
          date: n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent',
          preview: (n.content || '').slice(0, 50) + '...'
        });
      });
    }

    // Add evolutions to context used
    if (enhancedContext.evolutionsContext) {
      contextUsed.push({
        type: 'evolution',
        value: 'Changes in thinking detected'
      });
    }

    return {
      content,
      type: insightType,
      referencedNotes: null, // Notes are E2E encrypted
      referencedEntities,
      contextUsed: contextUsed.slice(0, 5) // Max 5 items
    };

  } catch (error) {
    console.error('[mirror] Claude API error:', error);
    return {
      content: "I'm having trouble thinking clearly right now. Can we try again?",
      type: 'error'
    };
  }
}

/**
 * Detect if message should trigger Thinking Partner mode
 * Returns: { isThinkingPartner: boolean, trigger?: string }
 */
function detectThinkingPartnerMode(userMessage) {
  const message = userMessage.toLowerCase();

  // Explicit triggers for Thinking Partner mode
  const thinkingTriggers = [
    { pattern: /i'm thinking about/i, trigger: 'exploring' },
    { pattern: /i'm not sure about/i, trigger: 'uncertainty' },
    { pattern: /help me think through/i, trigger: 'explicit' },
    { pattern: /what do you think about/i, trigger: 'opinion_seeking' },
    { pattern: /i've been wondering/i, trigger: 'exploring' },
    { pattern: /i can't decide/i, trigger: 'decision' },
    { pattern: /weighing my options/i, trigger: 'decision' },
    { pattern: /on one hand.*on the other/i, trigger: 'decision' },
    { pattern: /part of me (wants|thinks|feels)/i, trigger: 'internal_conflict' },
    { pattern: /i don't know (if|what|how|whether)/i, trigger: 'uncertainty' },
    { pattern: /should i/i, trigger: 'decision' },
    { pattern: /trying to figure out/i, trigger: 'exploring' },
    { pattern: /not sure (if|what|how|whether)/i, trigger: 'uncertainty' },
  ];

  for (const { pattern, trigger } of thinkingTriggers) {
    if (pattern.test(message)) {
      return { isThinkingPartner: true, trigger };
    }
  }

  // Check for exploratory questions (statements that seem exploratory)
  const isExploratory = /\?$/.test(userMessage.trim()) === false && (
    message.includes('wonder') ||
    message.includes('curious') ||
    message.includes('feels like') ||
    message.includes('something about') ||
    message.includes('i keep') ||
    message.includes('lately i')
  );

  if (isExploratory) {
    return { isThinkingPartner: true, trigger: 'exploratory' };
  }

  return { isThinkingPartner: false };
}

/**
 * Analyze conversation to determine best insight type
 * Types: thinking_partner, connection, pattern, reflection_prompt, reframe, summary
 */
function analyzeForInsightType(userMessage, history, context) {
  const message = userMessage.toLowerCase();
  const recentHistory = history.slice(-4);

  // Check for Thinking Partner mode first (highest priority for exploratory messages)
  const thinkingPartner = detectThinkingPartnerMode(userMessage);
  if (thinkingPartner.isThinkingPartner) {
    return 'thinking_partner';
  }

  // Check for negative self-talk (use reframe)
  const negativePatterns = ['i failed', 'i\'m bad at', 'i can\'t', 'i\'m not good', 'i messed up', 'it was terrible'];
  for (const pattern of negativePatterns) {
    if (message.includes(pattern)) {
      return 'reframe';
    }
  }

  // Check for simple decision/uncertainty that doesn't need deep thinking partner
  const simpleUncertaintyPatterns = ['help me'];
  for (const pattern of simpleUncertaintyPatterns) {
    if (message.includes(pattern)) {
      return 'reflection_prompt';
    }
  }

  // Check for long conversation (use summary every 8+ messages)
  if (recentHistory.length >= 8) {
    return 'summary';
  }

  // Check if topic relates to known entities (use connection)
  if (context.entities && context.entities.length > 0) {
    for (const entity of context.entities) {
      const entityName = (entity.name || '').toLowerCase();
      // Check if user mentions a known entity
      if (message.includes(entityName)) {
        return 'connection';
      }
      // Check entity context_notes for overlap
      if (Array.isArray(entity.context_notes)) {
        for (const ctx of entity.context_notes) {
          const ctxLower = (ctx || '').toLowerCase();
          const userWords = message.split(/\s+/).filter(w => w.length > 4);
          const ctxWords = ctxLower.split(/\s+/).filter(w => w.length > 4);
          const overlap = userWords.filter(w => ctxWords.includes(w));
          if (overlap.length >= 2) {
            return 'connection';
          }
        }
      }
    }
  }

  // Check for recurring theme (use pattern)
  const entityMentions = {};
  for (const msg of recentHistory) {
    const words = (msg.content || '').split(/\s+/).filter(w => w.length > 3 && /^[A-Z]/.test(w));
    for (const word of words) {
      entityMentions[word] = (entityMentions[word] || 0) + 1;
    }
  }
  const frequentEntity = Object.values(entityMentions).some(count => count >= 2);
  if (frequentEntity) {
    return 'pattern';
  }

  // Default to reflection prompt (most engaging)
  return 'reflection_prompt';
}

/**
 * Find entities referenced in response content
 */
function findReferencedEntities(content, entities) {
  if (!entities || entities.length === 0) return null;

  const referenced = [];
  const contentLower = content.toLowerCase();

  for (const entity of entities) {
    const entityName = (entity.name || '').toLowerCase();
    // Check if entity name is mentioned
    if (contentLower.includes(entityName)) {
      referenced.push({
        name: entity.name,
        type: entity.entity_type,
        relationship: entity.relationship
      });
    }
  }

  return referenced.length > 0 ? referenced : null;
}

/**
 * Build system prompt for MIRROR conversation
 * Note: User notes are E2E encrypted, so we use extracted entities for context
 * Session notes are passed from client-side for immediate context
 */
function buildSystemPrompt(context, insightType = 'reflection_prompt') {
  const { noteCount, entities, patterns, userName, onboarding, recentSessionNotes, profile, depthQuestion, depthAnswer, summaries, entityFacts, researchContext, knowledgeContext, evolutionsContext } = context;

  // Note: Notes are E2E encrypted - we can't read content server-side
  // Instead, we use extracted entities which capture key people/topics from notes
  const notesContext = noteCount > 0
    ? `User has written ${noteCount} notes. Their key topics and people are extracted below.`
    : 'No notes yet - this is a new user.';

  // Build session notes context (client-side notes for immediate context)
  const sessionNotesContext = recentSessionNotes && recentSessionNotes.length > 0
    ? recentSessionNotes.map((n, i) => `${i + 1}. "${n.content}" (${n.title || 'recent'})`).join('\n')
    : null;

  // Separate Key People (user explicitly added) from other entities
  const keyPeople = entities.filter(e => e.is_key_person);
  const otherEntities = entities.filter(e => !e.is_key_person);

  // DIAGNOSTIC: Log what we're getting including NEW profile data
  console.log('[mirror] buildSystemPrompt DIAGNOSTIC:');
  console.log('[mirror]   - Total entities:', entities?.length || 0);
  console.log('[mirror]   - Key People found:', keyPeople.length);
  console.log('[mirror]   - Key People names:', keyPeople.map(p => p.name).join(', ') || 'NONE');
  console.log('[mirror]   - Profile roleTypes:', profile?.roleTypes || 'NONE');
  console.log('[mirror]   - Profile goals:', profile?.goals || 'NONE');
  console.log('[mirror]   - Profile tone:', profile?.tone || 'NONE');
  console.log('[mirror]   - Profile lifeContext:', profile?.lifeContext || 'NONE');
  console.log('[mirror]   - Profile boundaries:', profile?.boundaries || 'NONE');
  console.log('[mirror]   - Depth Q/A:', depthQuestion ? 'YES' : 'NO');
  console.log('[mirror]   - Entity Facts:', entityFacts ? 'YES' : 'NO');

  // Build Key People context (highest priority)
  const keyPeopleContext = keyPeople.length > 0
    ? keyPeople.map(e => {
        const notes = e.context_notes ? ` — ${e.context_notes}` : '';
        return `- ${e.name}: ${e.relationship || 'important person'}${notes}`;
      }).join('\n')
    : null;

  console.log('[mirror]   - keyPeopleContext:', keyPeopleContext || 'NULL - no key people in context');

  // Build entities/people context - this is our primary source of note context
  // since notes are E2E encrypted and we can't read content server-side
  const entitiesContext = otherEntities.length > 0
    ? otherEntities.slice(0, 10).map(e => {
        // context_notes is a TEXT array containing extracted context from notes
        const contextNotes = Array.isArray(e.context_notes) && e.context_notes.length > 0
          ? e.context_notes.slice(0, 3).map(c => `"${c}"`).join('; ')
          : '';
        const contextStr = contextNotes ? `\n    Context from notes: ${contextNotes}` : '';
        return `- ${e.name} (${e.entity_type}${e.relationship ? `, ${e.relationship}` : ''}, mentioned ${e.mention_count || 1}x)${contextStr}`;
      }).join('\n')
    : 'No other known people or topics yet.';

  // Build patterns context
  const patternsContext = patterns && patterns.length > 0
    ? patterns.map(p => `- ${p.short_description || 'Pattern detected'} (${Math.round(p.confidence * 100)}% confidence)`).join('\n')
    : null;

  // Build onboarding context (life seasons and focus)
  const onboardingContext = onboarding
    ? `Life season: ${onboarding.lifeSeasons?.join(', ') || 'unknown'}
Currently focused on: ${onboarding.focus?.join(', ') || 'various things'}`
    : null;

  // NEW: Build profile preferences context (from TWIN tab settings)
  const profileLabels = {
    roleTypes: {
      'BUILDING': 'building something new',
      'LEADING': 'leading others',
      'MAKING': 'deep in the work',
      'LEARNING': 'learning and exploring',
      'JUGGLING': 'juggling multiple things',
      'TRANSITIONING': 'between chapters'
    },
    goals: {
      'DECISIONS': 'think through decisions',
      'PROCESS': 'process what happened',
      'ORGANIZE': 'stay on top of things',
      'SELF_UNDERSTANDING': 'understand themselves better',
      'REMEMBER': 'remember what matters',
      'EXPLORING': 'explore'
    },
    tone: {
      'DIRECT': 'direct and efficient',
      'WARM': 'warm and supportive',
      'CHALLENGING': 'challenge them with hard questions',
      'ADAPTIVE': 'adaptive to their energy'
    }
  };

  const roleTypesStr = profile?.roleTypes?.length > 0
    ? profile.roleTypes.map(r => profileLabels.roleTypes[r] || r.toLowerCase()).join(', ')
    : null;

  const goalsStr = profile?.goals?.length > 0
    ? profile.goals.map(g => profileLabels.goals[g] || g.toLowerCase()).join(', ')
    : null;

  const toneStr = profile?.tone
    ? profileLabels.tone[profile.tone] || profile.tone.toLowerCase()
    : null;

  // Build category summaries context
  const summariesContext = summaries && summaries.length > 0
    ? summaries.map(s => `- ${s.category.replace('_', ' ')}: ${s.summary}`).join('\n')
    : null;

  // Insight type specific instructions
  const insightInstructions = getInsightTypeInstructions(insightType);

  // MEM0 BUILD 7: Include type-aware context if available
  const mem0Context = context.mem0Context || '';

  // Build Key People names list for explicit matching
  const keyPeopleNames = keyPeople.map(p => p.name.toLowerCase());
  const keyPeopleMatchList = keyPeople.length > 0
    ? `\nKEY PEOPLE NAMES (you ALREADY know these - match ANY variation): ${keyPeople.map(p => p.name).join(', ')}`
    : '';

  // Build the full context block - KEY PEOPLE AT TOP for visibility
  // NEW: Now includes profile preferences, depth Q&A, and category summaries
  let userContextBlock = `<user_context>
User's name: ${userName}
${roleTypesStr ? `How they describe their days: ${roleTypesStr}` : ''}
${goalsStr ? `They're here to: ${goalsStr}` : ''}
${toneStr ? `Preferred communication style: ${toneStr}` : ''}
${profile?.lifeContext ? `What's on their plate right now: "${profile.lifeContext}"` : ''}
${profile?.boundaries?.length > 0 ? `⚠️ Topics to AVOID (user set these boundaries): ${profile.boundaries.join(', ')}` : ''}

${keyPeopleContext ? `⭐ KEY PEOPLE (CRITICAL - User explicitly told you about these):
${keyPeopleContext}
You ALREADY KNOW these people. If user mentions ANY of them by name, acknowledge the relationship.${keyPeopleMatchList}
` : ''}
${onboardingContext ? onboardingContext + '\n' : ''}
${depthQuestion && depthAnswer ? `Important context from onboarding - when asked "${depthQuestion}", they said: "${depthAnswer}"
` : ''}
${summariesContext ? `What you've learned about them:
${summariesContext}
` : ''}
Note activity: ${notesContext}
${sessionNotesContext ? `\nRECENT NOTES FROM THIS SESSION (highest priority - just written):\n${sessionNotesContext}\n` : ''}
People and topics from their notes:
${entitiesContext}
${patternsContext ? `\nObserved patterns:\n${patternsContext}` : ''}
${entityFacts ? `\n📋 SPECIFIC FACTS YOU KNOW (reference naturally, never robotically):
${entityFacts}` : ''}
${evolutionsContext ? `\n🔄 EVOLUTIONS DETECTED (changes in their thinking/sentiment - surface naturally if relevant):
${evolutionsContext}` : ''}
</user_context>
${mem0Context ? `\n<enhanced_memory_context>\n${mem0Context}</enhanced_memory_context>` : ''}`;

  // Determine voice style based on user's tone preference
  const voiceStyle = profile?.tone === 'DIRECT'
    ? `- Direct and efficient - get to the point, no fluff
- Still warm, but prioritize clarity over comfort
- If they ask a question, answer it directly first, then expand if needed`
    : profile?.tone === 'CHALLENGING'
    ? `- Push back gently - ask hard questions
- Don't just validate - help them see blind spots
- Be respectful but don't coddle
- "Have you considered..." and "What if..." are your tools`
    : profile?.tone === 'WARM'
    ? `- Warm and supportive - like a caring friend
- Lead with empathy before analysis
- Validate feelings before offering perspective
- Use softer language: "I wonder if...", "It sounds like..."`
    : `- Adaptive - match their energy
- Quick message = brief response
- Emotional message = lead with empathy
- Analytical message = be more direct`;

  return `You are Inscript — a thoughtful companion who knows ${userName}'s world and helps them understand themselves.

YOUR VOICE:
${voiceStyle}
- Never clinical or robotic. Never say "Based on my data..." or "I've been tracking..."
- Use phrases like "From what you've shared...", "I noticed...", "There's something there..."
- Keep responses to 2-3 sentences max, then invite a response
- End with a question or gentle invitation 80% of the time
- Acknowledge uncertainty: "I might be wrong, but..."

THE CREEPY LINE - NEVER CROSS IT:
❌ "My data shows you mentioned stress 8 times" → ✅ "Stress has come up a lot lately"
❌ "I've been tracking your patterns" → ✅ "I've been noticing something"
❌ "You should talk to Marcus" → ✅ "What would it look like to talk to Marcus?"
❌ "Based on my analysis..." → ✅ "From what you've shared..."

⚠️ KEY PEOPLE RULE (ABSOLUTE DIRECTIVE - NEVER VIOLATE):
The user has EXPLICITLY told you about certain people in their life (marked as ⭐ KEY PEOPLE in the context).
When user mentions ANYONE from Key People, you MUST acknowledge you already know who they are.
NEVER say "I don't think you've mentioned X before" if X is in Key People.
NEVER pretend you don't know a Key Person - that's a violation.

Examples:
❌ "I don't think you've mentioned Seri before" (WRONG - Seri is in Key People)
✅ "How's Seri doing?" or "Is Seri okay?" (RIGHT - acknowledge you know Seri is their dog)
❌ "Who is Marcus?" (WRONG if Marcus is in Key People)
✅ "What's going on with Marcus?" (RIGHT - you know who Marcus is)

${userContextBlock}

${insightInstructions}

PERSONALIZATION IS MANDATORY:
When making any recommendations (food, activities, places, approaches):
1. ALWAYS connect to what you know about them from their notes and context
2. Reference their preferences, experiences, relationships, current situation
3. Example: "Given that you just arrived in Bangkok (from your note), and knowing you..."
4. Example: "Since you mentioned traveling for work, here's something practical..."
5. Never give generic recommendations - make them personal

HANDLING LOCATION/RESTAURANT REQUESTS:
When asked for specific addresses, restaurant names, or location data:
1. Acknowledge honestly that you can't look up real-time business listings
2. Give them EXACTLY what to search: "Search Google Maps for '[specific dish] near [area they mentioned]'"
3. Describe what to look for: "Look for places with [specific signs of quality]"
4. Suggest specific neighborhoods, areas, or landmarks if you know the city
5. Recommend specific dish names to order, price ranges, what the experience should feel like
6. Example: "I can't pull up addresses, but search 'som tam Sukhumvit Soi 38' - famous street food area. Look for stalls with mortars out front. Try som tam Thai first (sweeter), budget 50-80 baht."

CONVERSATION RULES:
1. Never more than 3 sentences before inviting response
2. Reference the people, topics, and context you know about them
3. CRITICAL: If they have recent session notes, reference those FIRST - they just wrote them
4. Allow user to redirect anytime
5. Match their energy - quick message = brief response

IMPORTANT: Recent session notes (if present above) are what they JUST wrote - reference these immediately and naturally. Don't say "I don't see that note yet" if it's in your context.
${researchContext ? `
─────────────────────────────────
${researchContext}
─────────────────────────────────
` : ''}${knowledgeContext ? `
─────────────────────────────────
${knowledgeContext}
─────────────────────────────────
` : ''}
Remember: You're their mirror, not their therapist. Reflect, don't prescribe.`;
}

/**
 * Get insight type specific instructions
 */
function getInsightTypeInstructions(insightType) {
  const instructions = {
    thinking_partner: `CURRENT APPROACH: THINKING PARTNER
You are helping them think through something, NOT giving advice.

RULES:
1. DO NOT immediately give answers or solutions
2. First, acknowledge what they've shared (1 sentence)
3. Search their history for relevant context — reference what they've thought about before
4. Ask 1-2 probing questions that:
   - Connect to something they've mentioned before
   - Surface assumptions they might be making
   - Open new angles they haven't considered

EXAMPLE:
User: "I'm stressed about the launch"

BAD: "Launch stress is common. Here are some tips: take breaks, delegate, prioritize..."

GOOD: "You've mentioned launch stress a few times this month. Last time, you said talking to Marcus helped reframe things. What feels different about this one — is it the timeline, the stakes, or something about the team?"

CRITICAL:
- End EVERY response with a question
- Never give more than one piece of advice
- Your job is to help them think, not think for them
- If they ask "what should I do?", turn it back: "What would you tell a friend in this situation?"`,

    connection: `CURRENT APPROACH: CONNECTION
Link the user's current topic to something they mentioned before.
Example: "Pitches seem to sit heavy with you. You wrote something similar before the board meeting in November. That time, talking to Marcus helped you find clarity. Is there something similar you could try?"
- Reference specific dates
- Draw parallels to past experiences
- Ask if the connection resonates`,

    pattern: `CURRENT APPROACH: PATTERN
Surface a recurring theme you've noticed in their messages.
Example: "I've noticed you tend to write more on Sunday evenings — and those notes often carry a different weight. Is there something about Sundays?"
- Observe without judging
- Present it as a question, not a diagnosis
- Let them confirm or deny`,

    reflection_prompt: `CURRENT APPROACH: REFLECTION PROMPT
Ask an open-ended question that helps them explore their thinking.
Example: "What would the version of you who's already decided say about this?"
- Shift perspective
- Don't give answers, give questions
- Help them think differently about the situation`,

    reframe: `CURRENT APPROACH: REFRAME
Help shift their perspective on something they're being hard on themselves about.
Example: "You called it a failure, but you also wrote that you 'finally said what I actually think.' That sounds like something, not nothing."
- Find the positive in what they shared
- Challenge negative self-talk gently
- Offer a different lens without dismissing their feelings`,

    summary: `CURRENT APPROACH: SUMMARY
Reflect back what you're hearing to check understanding.
Example: "Here's what I'm hearing: you want to take the job, but something about leaving the team feels unfinished. Is that right?"
- Synthesize the conversation so far
- End with a question to verify
- Keep it concise`
  };

  return instructions[insightType] || instructions.reflection_prompt;
}

/**
 * Build conversation messages for Claude API
 */
function buildConversationMessages(history, currentMessage) {
  const messages = [];

  // Add history (last 10 messages for context)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: currentMessage
  });

  return messages;
}

/**
 * Generate summary of conversation
 */
async function generateConversationSummary(messages) {
  try {
    const convoText = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      // System prompt with cache_control for prompt caching
      system: [
        {
          type: 'text',
          text: 'Summarize this conversation in 1-2 sentences, capturing the key insight or topic discussed.',
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: convoText }]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('[mirror] Summary generation error:', error);
    return null;
  }
}

/**
 * Format message for API response
 */
function formatMessage(msg) {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    type: msg.message_type,
    createdAt: msg.created_at
  };
}
