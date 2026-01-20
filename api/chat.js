/**
 * /api/chat - Phase 4B: Socratic dialogue for notes
 * Provides thoughtful follow-up questions and reflections
 * Enhanced with Mem0 memory context for personalization
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get memory context for personalized chat
 */
async function getMemoryContextForChat(userId) {
  if (!supabase || !userId) return '';

  try {
    // Get category summaries
    const { data: summaries } = await supabase
      .from('category_summaries')
      .select('category, summary')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(3);

    // Get top entities
    const { data: entities } = await supabase
      .from('user_entities')
      .select('name, entity_type, relationship, context_notes')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('importance_score', { ascending: false })
      .limit(8);

    const parts = [];

    if (summaries?.length > 0) {
      parts.push('What you know about them:');
      summaries.forEach(s => {
        parts.push(`- ${s.category.replace('_', ' ')}: ${s.summary}`);
      });
    }

    if (entities?.length > 0) {
      parts.push('\nKey people/things in their world:');
      entities.forEach(e => {
        const rel = e.relationship ? ` (${e.relationship})` : '';
        parts.push(`- ${e.name}${rel}`);
      });
    }

    return parts.length > 0 ? parts.join('\n') : '';
  } catch (err) {
    console.warn('[Chat] Memory context error:', err.message);
    return '';
  }
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { noteContent, noteAnalysis, chatHistory, userMessage, mode, userId } = req.body;

  if (!noteContent || !userMessage) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Get memory context for personalization
    const memoryContext = userId ? await getMemoryContextForChat(userId) : '';
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
