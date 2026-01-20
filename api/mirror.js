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
 * Priority order:
 * 1. Recency + Frequency (3+ mentions in 7 days)
 * 2. Emotional Signal (stress, excitement, uncertainty)
 * 3. Pattern Confirmation (unverified pattern above 80%)
 * 4. Time-based Continuity (last conversation left thread open)
 * 5. Milestone (10th note, 30 days of use, etc.)
 * 6. Gentle Presence (no strong signal)
 */
async function findBestSignal(user_id) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get recent notes for analysis
  const { data: recentNotes } = await supabase
    .from('notes')
    .select('id, content, created_at, classification')
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  // PRIORITY 1: Recency + Frequency
  const frequencySignal = await checkFrequencySignal(recentNotes);
  if (frequencySignal) return frequencySignal;

  // PRIORITY 2: Emotional Signal
  const emotionalSignal = checkEmotionalSignal(recentNotes);
  if (emotionalSignal) return emotionalSignal;

  // PRIORITY 3: Pattern Confirmation
  const patternSignal = await checkPatternSignal(user_id);
  if (patternSignal) return patternSignal;

  // PRIORITY 4: Time-based Continuity
  const continuitySignal = await checkContinuitySignal(user_id);
  if (continuitySignal) return continuitySignal;

  // PRIORITY 5: Milestone
  const milestoneSignal = await checkMilestoneSignal(user_id, recentNotes?.length || 0);
  if (milestoneSignal) return milestoneSignal;

  // No strong signal
  return null;
}

/**
 * Check for frequency-based signal (entity mentioned 3+ times)
 */
async function checkFrequencySignal(recentNotes) {
  if (!recentNotes || recentNotes.length < 3) return null;

  // Look for recurring themes/entities
  const entityMentions = {};
  const notesByEntity = {};

  for (const note of recentNotes) {
    const content = note.content || '';
    // Extract capitalized words as potential entities
    const words = content.split(/\s+/).filter(w => w.length > 3 && /^[A-Z]/.test(w));
    for (const word of words) {
      entityMentions[word] = (entityMentions[word] || 0) + 1;
      if (!notesByEntity[word]) notesByEntity[word] = [];
      notesByEntity[word].push(note);
    }
  }

  // Find entity mentioned 3+ times
  const frequentEntity = Object.entries(entityMentions)
    .sort((a, b) => b[1] - a[1])
    .find(([_, count]) => count >= 3);

  if (frequentEntity) {
    const [entity, count] = frequentEntity;
    return {
      message: `${entity} has come up ${count} times this week. There seems to be something on your mind. Want to explore it?`,
      buttons: [
        { label: "Let's explore", action: "explore" },
        { label: "Not now", action: "dismiss" }
      ],
      data: { type: 'frequency', entity, count }
    };
  }

  return null;
}

/**
 * Check for emotional signals in recent notes
 */
function checkEmotionalSignal(recentNotes) {
  if (!recentNotes || recentNotes.length === 0) return null;

  // Emotional keywords to look for
  const stressKeywords = ['stressed', 'stress', 'overwhelmed', 'anxious', 'worried', 'exhausted', 'frustrated', 'struggling'];
  const excitementKeywords = ['excited', 'thrilled', 'amazing', 'wonderful', 'incredible', 'happy', 'great news'];
  const uncertaintyKeywords = ['not sure', 'don\'t know', 'confused', 'uncertain', 'wondering', 'should I', 'maybe'];

  let stressCount = 0;
  let excitementCount = 0;
  let uncertaintyCount = 0;

  for (const note of recentNotes.slice(0, 5)) { // Check last 5 notes
    const content = (note.content || '').toLowerCase();

    for (const keyword of stressKeywords) {
      if (content.includes(keyword)) stressCount++;
    }
    for (const keyword of excitementKeywords) {
      if (content.includes(keyword)) excitementCount++;
    }
    for (const keyword of uncertaintyKeywords) {
      if (content.includes(keyword)) uncertaintyCount++;
    }
  }

  // Threshold of 2+ emotional signals
  if (stressCount >= 2) {
    return {
      message: "Your last few notes have felt heavy. There's something weighing on you. Want to talk about it?",
      buttons: [
        { label: "Yes, let's talk", action: "explore" },
        { label: "Not right now", action: "dismiss" }
      ],
      data: { type: 'emotional', emotion: 'stress', count: stressCount }
    };
  }

  if (excitementCount >= 2) {
    return {
      message: "There's been a lot of energy in your recent notes. Something good is happening. Tell me about it?",
      buttons: [
        { label: "Yes!", action: "explore" },
        { label: "Maybe later", action: "dismiss" }
      ],
      data: { type: 'emotional', emotion: 'excitement', count: excitementCount }
    };
  }

  if (uncertaintyCount >= 2) {
    return {
      message: "You seem to be working through something. There's a decision brewing. Want to think it through together?",
      buttons: [
        { label: "That would help", action: "explore" },
        { label: "Not yet", action: "dismiss" }
      ],
      data: { type: 'emotional', emotion: 'uncertainty', count: uncertaintyCount }
    };
  }

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
 * Implements 5 insight types: Connection, Pattern, Reflection prompt, Reframe, Summary
 */
async function generateResponse(user_id, userMessage, history, context, additionalContext) {
  // Analyze the conversation to determine best insight type
  const insightType = analyzeForInsightType(userMessage, history, context);
  const systemPrompt = buildSystemPrompt(context, insightType);
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

    // Find referenced notes mentioned in response
    const referencedNotes = findReferencedNotes(content, context.notes);

    return {
      content,
      type: insightType,
      referencedNotes,
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
 * Analyze conversation to determine best insight type
 * Types: connection, pattern, reflection_prompt, reframe, summary
 */
function analyzeForInsightType(userMessage, history, context) {
  const message = userMessage.toLowerCase();
  const recentHistory = history.slice(-4);

  // Check for negative self-talk (use reframe)
  const negativePatterns = ['i failed', 'i\'m bad at', 'i can\'t', 'i\'m not good', 'i messed up', 'it was terrible'];
  for (const pattern of negativePatterns) {
    if (message.includes(pattern)) {
      return 'reframe';
    }
  }

  // Check for decision/uncertainty (use reflection_prompt)
  const uncertaintyPatterns = ['should i', 'don\'t know', 'not sure', 'can\'t decide', 'what do you think', 'help me'];
  for (const pattern of uncertaintyPatterns) {
    if (message.includes(pattern)) {
      return 'reflection_prompt';
    }
  }

  // Check for long conversation (use summary every 8+ messages)
  if (recentHistory.length >= 8) {
    return 'summary';
  }

  // Check if topic relates to past notes (use connection)
  if (context.notes && context.notes.length > 0) {
    for (const note of context.notes) {
      const noteContent = (note.content || '').toLowerCase();
      // Check for overlapping significant words
      const userWords = message.split(/\s+/).filter(w => w.length > 4);
      const noteWords = noteContent.split(/\s+/).filter(w => w.length > 4);
      const overlap = userWords.filter(w => noteWords.includes(w));
      if (overlap.length >= 2) {
        return 'connection';
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
 * Find notes referenced by content
 */
function findReferencedNotes(content, notes) {
  if (!notes || notes.length === 0) return null;

  const referenced = [];
  const contentLower = content.toLowerCase();

  for (const note of notes) {
    const noteDate = new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    // Check if date is mentioned
    if (contentLower.includes(noteDate.toLowerCase())) {
      referenced.push({
        id: note.id,
        date: noteDate,
        snippet: (note.content || '').substring(0, 50)
      });
    }
  }

  return referenced.length > 0 ? referenced : null;
}

/**
 * Build system prompt for MIRROR conversation
 */
function buildSystemPrompt(context, insightType = 'reflection_prompt') {
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

  // Insight type specific instructions
  const insightInstructions = getInsightTypeInstructions(insightType);

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

${insightInstructions}

CONVERSATION RULES:
1. Never more than 3 sentences before inviting response
2. Reference specific dates/notes when making connections
3. Allow user to redirect anytime
4. Match their energy - quick message = brief response

Remember: You're their mirror, not their therapist. Reflect, don't prescribe.`;
}

/**
 * Get insight type specific instructions
 */
function getInsightTypeInstructions(insightType) {
  const instructions = {
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
