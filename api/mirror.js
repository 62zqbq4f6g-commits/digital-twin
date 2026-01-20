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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Minimum notes required for full MIRROR experience
const MIN_NOTES_FOR_INSIGHTS = 5;

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

    return res.status(200).json({
      conversationId: existingConvo.id,
      isNewConversation: false,
      noteCount,
      opening,
      previousMessages: messages.map(formatMessage)
    });
  }

  // Create new conversation
  const opening = await generateOpening(user_id, noteCount);

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
    previousMessages: []
  });
}

/**
 * Handle user message and generate response
 */
async function handleMessage(req, res, user_id) {
  const { conversation_id, message, context } = req.body;

  if (!conversation_id || !message) {
    return res.status(400).json({ error: 'conversation_id and message required' });
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

  // Get user context (recent notes, entities)
  const userContext = await getUserContext(user_id);

  // Generate Inscript response
  const response = await generateResponse(user_id, message, history || [], userContext, context);

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

  return res.status(200).json({
    messageId: inscriptMsg.id,
    response: {
      content: response.content,
      insightType: response.type,
      referencedNotes: response.referencedNotes
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
async function generateOpening(user_id, noteCount) {
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
 */
async function findBestSignal(user_id) {
  // Priority 1: Recency + Frequency (3+ mentions in 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentNotes } = await supabase
    .from('notes')
    .select('content, created_at, classification')
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentNotes && recentNotes.length >= 3) {
    // Look for recurring themes/entities
    const entityMentions = {};
    for (const note of recentNotes) {
      const content = note.content || '';
      // Simple entity extraction (would be enhanced in Phase 13C)
      const words = content.split(/\s+/).filter(w => w.length > 3 && /^[A-Z]/.test(w));
      for (const word of words) {
        entityMentions[word] = (entityMentions[word] || 0) + 1;
      }
    }

    // Find entity mentioned 3+ times
    const frequentEntity = Object.entries(entityMentions)
      .find(([_, count]) => count >= 3);

    if (frequentEntity) {
      const [entity, count] = frequentEntity;
      return {
        message: `${entity} has come up ${count} times this week. There seems to be something on your mind about them. Want to explore it?`,
        buttons: [
          { label: "Let's explore", action: "explore" },
          { label: "Not now", action: "dismiss" }
        ],
        data: { type: 'frequency', entity, count }
      };
    }
  }

  // Priority 2: Unverified pattern above 80% confidence
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
 * Get user context for response generation
 */
async function getUserContext(user_id) {
  // Get recent notes
  const { data: recentNotes } = await supabase
    .from('notes')
    .select('id, content, created_at, classification')
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get entities
  const { data: entities } = await supabase
    .from('user_entities')
    .select('name, entity_type, relationship, compressed_context')
    .eq('user_id', user_id)
    .order('mention_count', { ascending: false })
    .limit(10);

  // Get user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('user_id', user_id)
    .single();

  return {
    notes: recentNotes || [],
    entities: entities || [],
    userName: profile?.name || 'there'
  };
}

/**
 * Generate Inscript response using Claude
 */
async function generateResponse(user_id, userMessage, history, context, additionalContext) {
  const systemPrompt = buildSystemPrompt(context);
  const messages = buildConversationMessages(history, userMessage);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.7,
      system: systemPrompt,
      messages
    });

    const content = response.content[0].text;

    // Detect insight type based on content
    let insightType = 'response';
    if (content.includes('I noticed') || content.includes('pattern')) {
      insightType = 'pattern';
    } else if (content.includes('similar to') || content.includes('mentioned before')) {
      insightType = 'connection';
    } else if (content.endsWith('?')) {
      insightType = 'question';
    }

    return {
      content,
      type: insightType,
      referencedNotes: null,
      referencedEntities: null
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
 * Build system prompt for MIRROR conversation
 */
function buildSystemPrompt(context) {
  const { notes, entities, userName } = context;

  const notesContext = notes.length > 0
    ? notes.slice(0, 5).map(n => {
        const date = new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const snippet = (n.content || '').substring(0, 100);
        return `- ${date}: "${snippet}..."`;
      }).join('\n')
    : 'No recent notes yet.';

  const entitiesContext = entities.length > 0
    ? entities.slice(0, 5).map(e => `- ${e.name} (${e.entity_type}${e.relationship ? `, ${e.relationship}` : ''})`).join('\n')
    : 'No known entities yet.';

  return `You are Inscript — a thoughtful companion who knows ${userName}'s world and helps them understand themselves.

YOUR VOICE:
- Warm and direct, like a close friend who remembers everything
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

WHAT YOU KNOW ABOUT ${userName.toUpperCase()}:

Recent notes:
${notesContext}

Key people/entities:
${entitiesContext}

CONVERSATION RULES:
1. Never more than 3 sentences before inviting response
2. Reference specific dates/notes when making connections
3. Allow user to redirect anytime
4. Match their energy - quick message = brief response

Remember: You're their mirror, not their therapist. Reflect, don't prescribe.`;
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
      system: 'Summarize this conversation in 1-2 sentences, capturing the key insight or topic discussed.',
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
