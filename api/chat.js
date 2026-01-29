/**
 * /api/chat - Phase 4B: Socratic dialogue for notes
 * Provides thoughtful follow-up questions and reflections
 * Enhanced with Mem0 memory context for personalization
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const { getUserFullContext, buildContextBlock } = require('./user-context.js');
const { setCorsHeaders, handlePreflight } = require('./lib/cors.js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get memory context for personalized chat
 * Now uses unified context fetcher for complete user data
 */
async function getMemoryContextForChat(userId) {
  if (!supabase || !userId) return '';

  try {
    // Use the unified context fetcher that gets ALL user data
    const fullContext = await getUserFullContext(supabase, userId);

    // Build formatted context string using the shared utility
    const contextStr = buildContextBlock(fullContext);

    console.log('[Chat] Full context loaded:', {
      userName: fullContext.userName,
      keyPeopleCount: fullContext.keyPeople?.length || 0,
      entitiesCount: fullContext.entities?.length || 0,
      hasLifeContext: !!fullContext.lifeContext,
      hasGoals: fullContext.goals?.length > 0
    });

    return contextStr;
  } catch (err) {
    console.warn('[Chat] Memory context error:', err.message);
    return '';
  }
}

module.exports = async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check - verify token and get userId
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  let userId;
  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    userId = user.id;
  } catch (authErr) {
    console.error('[Chat] Auth error:', authErr.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }

  const { noteContent, noteAnalysis, chatHistory, userMessage, mode } = req.body;

  if (!noteContent || !userMessage) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Get memory context for personalization using verified userId
    const memoryContext = await getMemoryContextForChat(userId);
    if (memoryContext) {
      console.log('[Chat] Retrieved memory context for user:', userId);
    }

    const systemPrompt = buildChatSystemPrompt(noteContent, noteAnalysis, mode, memoryContext);
    const messages = buildChatMessages(chatHistory, userMessage);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages
    });

    const assistantMessage = response.content[0].text.trim();

    return res.status(200).json({
      message: assistantMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({
      error: 'Failed to generate response',
      message: "I'm having trouble connecting. Try again in a moment."
    });
  }
};

/**
 * Build the system prompt for Socratic dialogue
 * Supports 4 modes: clarify, expand, challenge, decide
 * Enhanced with memory context for personalization
 */
function buildChatSystemPrompt(noteContent, noteAnalysis, mode, memoryContext = '') {
  const analysis = noteAnalysis || {};
  const isDecision = analysis.decision?.isDecision;
  const isPersonal = analysis.noteType === 'personal';

  // Mode-specific instructions
  const modeInstructions = getModeInstructions(mode);

  // Memory context section
  const memorySection = memoryContext ? `
## What You Know About This Person

${memoryContext}

⚠️ KEY PEOPLE RULE: If any KEY PEOPLE are listed above, you ALREADY KNOW them.
NEVER say "I don't think you've mentioned X before" if X is in Key People.
Acknowledge their relationship naturally (e.g., "How's Seri doing?" not "Who is Seri?").

Use this context naturally in your responses - reference people and patterns you know about when relevant.
` : '';

  let prompt = `You are a thoughtful companion helping someone think through their thoughts. Your role is to be a Socratic guide - asking questions that help them discover insights, not telling them what to think.
${memorySection}
## The Context

The user recorded this thought:
"""
${noteContent}
"""

${analysis.summary ? `Summary: ${analysis.summary}` : ''}
${analysis.whatThisReveals ? `What this reveals: ${analysis.whatThisReveals}` : ''}
${isDecision ? `This appears to be a decision they're working through.` : ''}

## Your Mode: ${modeInstructions.name}

${modeInstructions.description}

## Your Approach

${modeInstructions.approach}

## Tone

- Warm but not effusive
- Curious, not interrogating
- Brief - 2-4 sentences max per response
- One question at a time (don't overwhelm)

## BANNED Phrases
- "That's a great question"
- "I hear you"
- "That makes sense"
- "Have you considered..."
- Generic affirmations

## Examples

${modeInstructions.examples}`;

  return prompt;
}

/**
 * Get mode-specific instructions for chat
 */
function getModeInstructions(mode) {
  const modes = {
    clarify: {
      name: 'CLARIFY',
      description: 'Help the user get clearer on what they actually mean or feel. Surface the specific details beneath vague language.',
      approach: `1. **Identify vague words** - "interesting", "weird", "good" - ask what they really mean
2. **Ask for specifics** - "When you say X, what specifically comes to mind?"
3. **Unpack feelings** - "That feeling of 'off' - can you describe it more?"
4. **Distinguish similar things** - "How is this different from [related thing]?"`,
      examples: `User: "The meeting felt weird"
Good: "When you say 'weird' - was it the energy in the room, something someone said, or something else?"

User: "I'm not sure about this opportunity"
Good: "What's the specific hesitation? Is it the role itself, the timing, or something about the people involved?"`
    },
    expand: {
      name: 'EXPAND',
      description: 'Help the user see more dimensions, implications, and connections they might be missing.',
      approach: `1. **Widen the lens** - "What else does this connect to in your life?"
2. **Surface implications** - "If that's true, what else might be true?"
3. **Find patterns** - "Where else have you felt this way?"
4. **Explore ripple effects** - "How might this affect [other area]?"`,
      examples: `User: "I keep saying yes to things I don't want to do"
Good: "Where else in your life does this pattern show up? Work? Friendships? Family?"

User: "I realized I'm happiest when creating"
Good: "What would your life look like if you built more of it around that?"`
    },
    challenge: {
      name: 'CHALLENGE',
      description: 'Gently push back on assumptions and help the user see blind spots or alternative perspectives.',
      approach: `1. **Question assumptions** - "What are you assuming has to be true?"
2. **Flip the frame** - "What if the opposite were true?"
3. **Steelman the other side** - "What would someone who disagrees say?"
4. **Test the belief** - "What evidence would change your mind?"`,
      examples: `User: "I have to take this job because it pays well"
Good: "What would 'have to' actually look like? What's the real cost of saying no?"

User: "They don't respect my time"
Good: "What if they genuinely don't realize how their requests land? What would that change?"`
    },
    decide: {
      name: 'DECIDE',
      description: 'Help the user move toward clarity on a decision by surfacing what they already know but haven\'t admitted.',
      approach: `1. **Cut through noise** - "Forget the pros and cons - what does your gut say?"
2. **Surface the real question** - "What is this decision actually about for you?"
3. **Test commitment** - "If you had to decide right now, which way would you go?"
4. **Find the blocker** - "What would need to be true for this to feel like an easy yes?"`,
      examples: `User: "I'm torn between staying and leaving"
Good: "If you woke up tomorrow and the decision was made - which outcome would feel like relief?"

User: "I don't know which opportunity to pursue"
Good: "Forget which is 'better' - which one are you actually excited about?"`
    }
  };

  return modes[mode] || modes.clarify;
}

/**
 * Build chat messages array for the API
 */
function buildChatMessages(chatHistory, userMessage) {
  const messages = [];

  // Add previous chat history
  if (chatHistory && Array.isArray(chatHistory)) {
    chatHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
  }

  // Add the new user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
}
