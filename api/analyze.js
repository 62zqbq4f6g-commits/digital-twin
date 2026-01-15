/**
 * /api/analyze - Phase 5E: 3-Stage Processing Pipeline
 * STAGE 1: Clean transcript (dedicated)
 * STAGE 2: Classify (work / personal_task / personal_reflection)
 * STAGE 3: Analyze with appropriate prompt
 * Returns: cleaned, core, entities, actions, decision
 */

const Anthropic = require('@anthropic-ai/sdk');

// Visual entity extraction instruction (added to prompt when image present)
// CRITICAL LANGUAGE RULE - Enforces second-person language in all outputs
const CRITICAL_LANGUAGE_RULE = `
## CRITICAL LANGUAGE RULE — READ THIS FIRST

ALL output text MUST use SECOND-PERSON language. This is non-negotiable.

ALWAYS USE:
- "your" (e.g., "your dog Seri", "your meeting", "your co-founder")
- "you" (e.g., "you mentioned", "you need to")
- "you're", "you've", "you'll"

NEVER USE:
- "the user" or "the user's"
- "they", "them", "their" (when referring to the note author)
- "one's" or "one"
- Third-person references to the person who wrote the note

EXAMPLES:
❌ WRONG: "The user's French Bulldog needs a vet appointment"
✅ RIGHT: "Your French Bulldog needs a vet appointment"

❌ WRONG: "The user mentioned they want to call their mom"
✅ RIGHT: "You mentioned you want to call your mom"

❌ WRONG: "Schedule vet visit for the user's dog Seri"
✅ RIGHT: "Schedule vet visit for your dog Seri"

❌ WRONG: "Reminder for the user to finish the deck"
✅ RIGHT: "Reminder to finish your deck"

This rule applies to: title, summary, actions, core.intent, and ALL text output.
`;

const VISUAL_ENTITY_INSTRUCTION = `
If this note contains an image with visible people, pets, or identifiable places/objects, extract visual descriptions.

## RELATIONSHIP EXTRACTION (CRITICAL)
When the user uses possessive language like "my dog", "my mom", "my co-founder", ALWAYS capture this relationship.
This is how we remember relationships between the user and their entities.

Examples of possessive patterns to capture:
- "my dog Seri" → relationship_to_user: "my dog"
- "my co-founder John" → relationship_to_user: "my co-founder"
- "my sister Sarah" → relationship_to_user: "my sister"
- "my car" → relationship_to_user: "my car"
- "my house" → relationship_to_user: "my house"

Return visual descriptions in this XML format at the END of your JSON response (outside the JSON block):

<visual_entities>
  <entity name="[Name]" type="[person|pet|place|object]" visual="[Brief visual description]" relationship="[possessive phrase from user's input, e.g. 'my dog']"/>
</visual_entities>

Examples:
<visual_entities>
  <entity name="Seri" type="pet" visual="Golden retriever with fluffy fur, wearing a red collar" relationship="my dog"/>
  <entity name="Sarah" type="person" visual="Woman with shoulder-length dark hair, wearing glasses" relationship="my sister"/>
  <entity name="Home Office" type="place" visual="Desk with dual monitors, plants on windowsill" relationship="my office"/>
</visual_entities>

RULES:
- Only include entities that are clearly visible in the image
- Keep descriptions concise (under 20 words each)
- For people: describe clothing, accessories, context - NOT physical judgments
- Use names mentioned in the note text to identify entities
- ALWAYS capture the possessive phrase (my dog, my mom, etc.) in the relationship attribute
- If user uses first-person language (I, me, my) with an image of a person, that's likely the user - do NOT extract as unknown person
`;

/**
 * Parse visual entities from response text
 * @param {string} responseText - Full response from Claude
 * @returns {Array} Array of visual entity objects
 */
function parseVisualEntities(responseText) {
  const visualEntities = [];

  // Match <visual_entities> block
  const visualMatch = responseText.match(/<visual_entities>([\s\S]*?)<\/visual_entities>/);

  if (!visualMatch) return visualEntities;

  // Extract each <entity .../> element
  const entityMatches = visualMatch[1].match(/<entity[^>]+\/>/g) || [];

  for (const entityTag of entityMatches) {
    // Extract attributes from each entity tag
    const nameMatch = entityTag.match(/name="([^"]+)"/);
    const typeMatch = entityTag.match(/type="([^"]+)"/);
    const visualMatch = entityTag.match(/visual="([^"]+)"/);
    const relationshipMatch = entityTag.match(/relationship="([^"]+)"/);

    const name = nameMatch ? nameMatch[1].trim() : '';
    const type = typeMatch ? typeMatch[1].trim().toLowerCase() : '';
    const visual = visualMatch ? visualMatch[1].trim() : '';
    const relationship = relationshipMatch ? relationshipMatch[1].trim() : null;

    if (name && type && visual) {
      const entity = {
        name,
        type,
        visual
      };
      // Add relationship_to_user if present
      if (relationship) {
        entity.relationship_to_user = relationship;
      }
      visualEntities.push(entity);
    }
  }

  console.log(`[Analyze] Parsed ${visualEntities.length} visual entities`);
  return visualEntities;
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

  const { input, context = {}, mode, noteType, preferencesXML, hasPersonalization, hasImage } = req.body;
  console.log('[Analyze] Received knownEntities:', JSON.stringify(context.knownEntities || []));
  console.log('[Analyze] Phase 7 - hasPersonalization:', hasPersonalization, 'preferencesXML length:', preferencesXML?.length || 0);
  console.log('[Analyze] Phase 8 - userProfile:', context.userProfile ? `${context.userProfile.userName}` : 'none');
  console.log('[Analyze] Visual Learning - hasImage:', hasImage || false);

  // Handle refine mode (Phase 3c)
  if (mode === 'refine') {
    return handleRefine(req, res);
  }

  if (!input?.content || input.content.trim().length < 10) {
    return res.status(400).json({ error: 'Content too short' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // ═══════════════════════════════════════════
    // STAGE 1: CLEAN TRANSCRIPT (dedicated step)
    // ═══════════════════════════════════════════
    const cleanedInput = await cleanTranscript(input.content, client);
    console.log('[Analyze] Stage 1 - Cleaned transcript:', cleanedInput);

    // ═══════════════════════════════════════════
    // STAGE 2: CLASSIFY NOTE
    // ═══════════════════════════════════════════
    // Use provided noteType or auto-classify
    let category = noteType;
    if (!noteType || noteType === 'auto' || noteType === 'productive') {
      category = await classifyNote(cleanedInput, client);
      console.log('[Analyze] Stage 2 - Classified as:', category);
    }

    // Determine processing mode
    const isReflection = category === 'personal_reflection';
    const shouldExtractActions = !isReflection;

    // ═══════════════════════════════════════════
    // STAGE 3: ANALYZE
    // ═══════════════════════════════════════════
    let systemPrompt, userPrompt;

    if (isReflection) {
      // Pure reflection - no actions, emotional insight
      systemPrompt = buildPersonalSystemPrompt(context, preferencesXML, hasImage);
      userPrompt = buildPersonalUserPrompt({ ...input, content: cleanedInput });
    } else {
      // Task mode - extract actions, practical insight
      systemPrompt = buildTaskSystemPrompt(context, category, preferencesXML, hasImage);
      userPrompt = buildTaskUserPrompt({ ...input, content: cleanedInput }, category);
    }

    // Phase 5F.2: Lower temperature for task notes to get predictable output
    const temperature = isReflection ? 0.7 : 0.3;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    // Parse response
    const responseText = message.content[0].text.trim();
    let result;

    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
      result = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      result = getFallbackAnalysis(cleanedInput, isReflection ? 'personal' : category);
    }

    // Inject the cleaned transcript (in case AI didn't return it properly)
    result.cleaned = result.cleaned || cleanedInput;
    result.cleanedInput = result.cleanedInput || cleanedInput;

    // Phase 5F.2: Strip emotional content from task notes
    if (!isReflection) {
      result = stripEmotionalContent(result, cleanedInput);
    }

    // Quality gate (skip for reflection notes - different quality criteria)
    if (!isReflection && isLowQuality(result)) {
      console.log('[Analyze] Low quality detected, regenerating...');
      result = await regenerateWithFeedback(client, systemPrompt, { ...input, content: cleanedInput }, result);
    }

    // Normalize the response structure
    const finalCategory = isReflection ? 'personal' : (category === 'personal_task' ? 'personal' : category);
    result = normalizeResponse(result, cleanedInput, isReflection ? 'personal' : null, shouldExtractActions);

    // Override category to match classification
    result.category = finalCategory;
    result.noteType = isReflection ? 'personal' : 'productive';

    // Phase 7: Include flag for preferences applied
    result.preferencesApplied = hasPersonalization || false;

    // Visual Learning: Parse visual entities if image was present
    let visualEntities = [];
    if (hasImage) {
      visualEntities = parseVisualEntities(responseText);
      if (visualEntities.length > 0) {
        console.log('[Analyze] Visual entities extracted:', JSON.stringify(visualEntities));
      }
    }
    result.visualEntities = visualEntities;

    return res.status(200).json(result);

  } catch (error) {
    console.error('Analyze API error:', error);
    return res.status(200).json(getFallbackAnalysis(input.content, noteType));
  }
};

/**
 * Phase 5F.2: Strip emotional content from task note responses
 * Detects and replaces poetic/emotional summaries with practical ones
 */
function stripEmotionalContent(result, cleanedInput) {
  // Banned emotional phrases
  const emotionalPatterns = [
    /tenderness/gi,
    /wellbeing/gi,
    /well-being/gi,
    /your care for/gi,
    /those who depend/gi,
    /weight of/gi,
    /holding.*responsibility/gi,
    /carry.*responsibility/gi,
    /beautiful/gi,
    /poetic/gi,
    /there's something/gi,
    /reveals about/gi,
    /shows how/gi,
    /speaks to/gi,
    /your relationship/gi,
    /emotional/gi,
    /in how you/gi,
    /the way you/gi,
  ];

  // Check if summary contains emotional content
  const summary = result.summary || result.insight || '';
  const hasEmotionalContent = emotionalPatterns.some(pattern => pattern.test(summary));

  if (hasEmotionalContent) {
    console.log('[Analyze] Detected emotional content, replacing with practical summary');

    // Generate practical summary based on actions
    const action = result.actions?.[0]?.action || '';
    let practicalSummary;

    if (action) {
      practicalSummary = `Task: ${action}`;
    } else {
      // Extract key nouns from cleaned input
      const lower = cleanedInput.toLowerCase();
      if (lower.includes('vet')) {
        practicalSummary = 'Vet appointment needed.';
      } else if (lower.includes('call')) {
        practicalSummary = 'Phone call to make.';
      } else if (lower.includes('email') || lower.includes('send')) {
        practicalSummary = 'Message to send.';
      } else if (lower.includes('finish') || lower.includes('complete')) {
        practicalSummary = 'Task to complete.';
      } else if (lower.includes('buy') || lower.includes('order')) {
        practicalSummary = 'Item to purchase.';
      } else if (lower.includes('schedule') || lower.includes('book')) {
        practicalSummary = 'Appointment to schedule.';
      } else {
        practicalSummary = 'Task reminder.';
      }
    }

    result.summary = practicalSummary;
    result.insight = practicalSummary;
  }

  // Also check and fix the title
  const title = result.title || '';
  const hasEmotionalTitle = emotionalPatterns.some(pattern => pattern.test(title));

  if (hasEmotionalTitle || title.length > 40) {
    // Generate practical title from action or input
    const action = result.actions?.[0]?.action || '';
    if (action) {
      result.title = action.length > 30 ? action.substring(0, 27) + '...' : action;
    } else {
      const words = cleanedInput.split(' ').slice(0, 4).join(' ');
      result.title = words.length > 30 ? words.substring(0, 27) + '...' : words;
    }
  }

  // Fix core.intent if emotional
  if (result.core?.intent) {
    const intentHasEmotion = emotionalPatterns.some(pattern => pattern.test(result.core.intent));
    if (intentHasEmotion) {
      const action = result.actions?.[0]?.action || 'Complete task';
      result.core.intent = action;
    }
  }

  return result;
}

/**
 * Phase 5E: Stage 1 - Clean and refine raw transcript
 * Dedicated step for transcript polishing before classification/analysis
 */
async function cleanTranscript(rawText, client) {
  const cleanPrompt = `You are a transcript cleaner. Your ONLY job is to polish raw speech into clean written text.

INPUT: "${rawText}"

RULES:
1. REMOVE all filler words: um, uh, mmm, hmm, like (when used as filler), you know, I mean, so (at start), well (at start), basically, actually (when filler), right, yeah, okay (when filler)

2. FIX punctuation:
   - Add periods at sentence ends
   - Add commas where natural pauses occur
   - Add question marks for questions
   - Capitalize first word of sentences

3. FIX grammar:
   - "i" → "I"
   - "dont" → "don't"
   - "cant" → "can't"
   - "im" → "I'm"
   - "ive" → "I've"
   - "its" when meaning "it is" → "it's"
   - "shes" → "she's"
   - "hes" → "he's"

4. CAPITALIZE proper nouns:
   - Names (seri → Seri, sarah → Sarah)
   - Places
   - Days of week (friday → Friday)

5. PRESERVE meaning:
   - Don't add words that weren't said
   - Don't change the intent
   - Keep the speaker's voice/tone

6. REMOVE false starts:
   - "I was... I mean, I need to" → "I need to"
   - "So like, um, basically" → remove entirely

OUTPUT: Return ONLY the cleaned text. No explanation, no quotes, no "Here is the cleaned text:". Just the polished text.

EXAMPLES:
Input: "um so like i need to call the vet for my dog seri"
Output: I need to call the vet for my dog Seri.

Input: "i was thinking about maybe um calling sarah you know about the meeting"
Output: I was thinking about calling Sarah about the meeting.

Input: "so basically i have to mmm finish the investor deck by friday"
Output: I have to finish the investor deck by Friday.

Input: "need to call vet for my dog seri shes not feeling well"
Output: Need to call the vet for my dog Seri. She's not feeling well.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3, // Low temperature for consistent cleaning
      messages: [{ role: 'user', content: cleanPrompt }]
    });

    let cleanedText = response.content[0]?.text?.trim();

    // Fallback: if response looks like an explanation, extract just the text
    if (cleanedText && cleanedText.includes(':') && cleanedText.length > rawText.length * 2) {
      const lines = cleanedText.split('\n');
      cleanedText = lines[lines.length - 1].trim();
    }

    // Basic validation
    if (!cleanedText || cleanedText.length < 5) {
      return basicClean(rawText);
    }

    return cleanedText;
  } catch (error) {
    console.error('Transcript cleaning failed:', error);
    return basicClean(rawText); // Fallback to basic cleaning
  }
}

/**
 * Basic transcript cleaning fallback
 */
function basicClean(text) {
  let cleaned = text
    .replace(/\b(um|uh|mmm|hmm|like|you know|so yeah|basically|literally)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Add period if missing
  if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}

/**
 * Phase 5E: Stage 2 - Classify note type
 * Three-way classification: work / personal_task / personal_reflection
 */
async function classifyNote(cleanedText, client) {
  const classifyPrompt = `Classify this text into ONE category:

TEXT: "${cleanedText}"

CATEGORIES:

1. "work" — Work, business, professional tasks
   Examples: "finish investor deck", "meeting with team", "send proposal", "email client"

2. "personal_task" — Personal life WITH a clear action/task
   Examples: "call vet for dog", "book dentist", "call mom", "buy groceries", "schedule doctor"
   KEY: Has something TO DO, even if it's personal/family related

3. "personal_reflection" — Emotional, reflective, no clear task
   Examples: "feeling down today", "thinking about life", "grateful for family", "missing my childhood"
   KEY: Processing feelings, NOT a to-do item

RULES:
- If there's ANY actionable task (call, book, send, buy, finish, schedule, email, write, create, etc.) → "work" or "personal_task"
- "personal_reflection" is ONLY for pure emotional processing with NO task
- Pet/family/health tasks with clear actions → "personal_task" (NOT "personal_reflection")
- When in doubt between task and reflection → choose task

OUTPUT: Return ONLY one word: "work", "personal_task", or "personal_reflection"`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 20,
      temperature: 0.1, // Very low for consistent classification
      messages: [{ role: 'user', content: classifyPrompt }]
    });

    const rawCategory = response.content[0]?.text?.trim().toLowerCase();

    // Extract just the category word
    const category = rawCategory.replace(/[^a-z_]/g, '');

    // Validate response
    if (['work', 'personal_task', 'personal_reflection'].includes(category)) {
      return category;
    }

    // Fallback: check for action words
    return classifyByKeywords(cleanedText);

  } catch (error) {
    console.error('Classification failed:', error);
    return classifyByKeywords(cleanedText);
  }
}

/**
 * Keyword-based classification fallback
 */
function classifyByKeywords(text) {
  const lower = text.toLowerCase();

  // Check for action verbs
  const hasActionWords = /\b(call|email|send|finish|complete|book|schedule|buy|get|make|write|prepare|meet|contact|text|message|create|build|plan|research|review|check|fix|resolve|update)\b/i.test(lower);

  if (!hasActionWords) {
    // Check for reflection patterns
    const isReflection = /\b(feeling|felt|thinking about|grateful|miss|remember|wondering|reflecting|nostalgic)\b/i.test(lower);
    if (isReflection) {
      return 'personal_reflection';
    }
  }

  // Check for work context
  const isWork = /\b(work|project|meeting|team|business|client|investor|proposal|deck|report|deadline|office|boss|colleague)\b/i.test(lower);
  if (isWork) {
    return 'work';
  }

  // Default: if has action words, it's a personal task
  if (hasActionWords) {
    return 'personal_task';
  }

  return 'personal_reflection';
}

/**
 * Phase 8: Build user profile context for prompt injection
 * Helps Twin know who the user is (self-awareness)
 */
function buildUserContext(userProfile) {
  if (!userProfile || !userProfile.userName) {
    return '';
  }

  const descriptors = userProfile.descriptors && userProfile.descriptors.length > 0
    ? userProfile.descriptors.join(', ')
    : 'Not provided';

  return `
<user_profile>
  <name>${userProfile.userName}</name>
  <about>${userProfile.aboutMe || 'Not provided'}</about>
  <descriptors>${descriptors}</descriptors>
</user_profile>

CRITICAL SELF-AWARENESS INSTRUCTION:
This note is from ${userProfile.userName}. When they say "I" or "me", they mean themselves.
- If an image shows a person AND the note uses first-person language (I, me, my, myself), that person is likely ${userProfile.userName} - do NOT extract as "unknown person"
- When referencing the user, use their name "${userProfile.userName}" or "you" appropriately
- The descriptors tell you about the user: ${descriptors}
`;
}

/**
 * Phase 5F.2 + Phase 6 + Phase 7 + Visual Learning: Task-focused system prompt with memory context and user preferences
 * Zero tolerance for emotional/poetic language
 */
function buildTaskSystemPrompt(context, category, preferencesXML = '', hasImage = false) {
  // Phase 8: Build user profile context
  const userProfileSection = buildUserContext(context.userProfile);

  // Phase 6: Build memory context section if known entities exist
  let memorySection = '';
  console.log('[Analyze] buildTaskSystemPrompt - knownEntities count:', context.knownEntities?.length || 0);
  console.log('[Analyze] buildTaskSystemPrompt - preferencesXML length:', preferencesXML?.length || 0);
  console.log('[Analyze] buildTaskSystemPrompt - userProfile:', context.userProfile?.userName || 'none');

  if (context.knownEntities && context.knownEntities.length > 0) {
    console.log('[Analyze] Building memory section with entities:', JSON.stringify(context.knownEntities));

    // Phase 6.1: Deduplicate and clean entities
    const entityMap = new Map();
    for (const e of context.knownEntities) {
      // Skip corrupted entries
      if (!e.name || e.name === '[Unknown]' || e.name.includes('[Unknown]')) {
        continue;
      }
      const key = e.name.toLowerCase();
      const existing = entityMap.get(key);
      // Keep the one with better details
      if (!existing || (e.details && e.details.length > (existing.details?.length || 0))) {
        entityMap.set(key, e);
      }
    }
    const cleanedEntities = Array.from(entityMap.values());
    console.log('[Analyze] Cleaned entities count:', cleanedEntities.length);

    if (cleanedEntities.length > 0) {
      // Phase 8: Build XML-formatted entity memory with relationship context
      const entityXml = cleanedEntities.map(e => {
        const attrs = [`name="${e.name}"`, `type="${e.type}"`];
        if (e.relationship) attrs.push(`relationship="${e.relationship}"`);
        if (e.userCorrected) attrs.push(`verified="true"`);

        let description;
        if (e.type === 'pet') {
          description = e.relationship
            ? `User's ${e.relationship} (${e.details || 'pet'}) named ${e.name}`
            : `The user's ${e.details || 'pet'} named ${e.name}`;
        } else if (e.relationship) {
          description = `User's ${e.relationship} named ${e.name}`;
        } else {
          description = `A ${e.type} the user knows: ${e.name}`;
        }

        return `  <entity ${attrs.join(' ')}>${description}</entity>`;
      }).join('\n');

      memorySection = `
<known_entities>
${entityXml}
</known_entities>

CRITICAL RELATIONSHIP-AWARE INSTRUCTIONS:
- When referencing entities, USE relationship context
- If relationship="co-founder", say "your co-founder Sarah" not just "Sarah"
- If type="pet" with relationship, say "your dog Seri" not just "Seri"
- If verified="true", this was explicitly confirmed by user - ALWAYS use this info
- Example: "Seri" → "your dog Seri" in actions/summaries
`;
      console.log('[Analyze] Memory section added to prompt (with relationships)');
    } else {
      console.log('[Analyze] All entities filtered out during cleaning');
    }
  } else {
    console.log('[Analyze] No memory section - knownEntities empty or missing');
  }

  return `You are a task extraction system. Output ONLY practical task information.
${userProfileSection}${memorySection}
${CRITICAL_LANGUAGE_RULE}
STOP. READ THIS FIRST:
- DO NOT write anything poetic
- DO NOT write anything emotional
- DO NOT analyze feelings
- DO NOT mention "tenderness", "care", "wellbeing", "relationship"
- DO NOT be a therapist

You are a TODO LIST, not a therapist.

INPUT TYPE: ${category === 'work' ? 'work task' : 'personal task'}

EXAMPLE INPUT: "need to call vet for my dog seri"

CORRECT OUTPUT:
{
  "title": "Call Vet for Seri",
  "cleaned": "Need to call the vet for my dog Seri.",
  "summary": "Vet appointment needed for Seri.",
  "core": {
    "topic": "Vet appointment",
    "emotion": "neutral",
    "intent": "Schedule vet visit"
  },
  "actions": [{
    "action": "Call vet for Seri",
    "effort": "quick",
    "why": "Pet needs care",
    "future_state": "→ Appointment booked"
  }],
  "category": "personal"
}

WRONG OUTPUT (DO NOT DO THIS):
{
  "title": "Caring for Seri",
  "summary": "There's tenderness in how you hold Seri's wellbeing...",  ← WRONG
  "core": {
    "intent": "Your care for those who depend on you..."  ← WRONG
  }
}

BANNED WORDS in summary/title/core:
- tenderness
- wellbeing
- care (as emotional concept)
- relationship
- hold/holding (metaphorically)
- weight (of responsibility)
- those who depend
- beautiful
- poetic
- emotional
- feeling
- heart

OUTPUT FORMAT (JSON only):
{
  "title": "3-5 word practical title",
  "cleaned": "Polished transcript",
  "summary": "ONE sentence. What needs to be done. PRACTICAL ONLY.",
  "core": {
    "topic": "2-4 words, the subject",
    "emotion": "neutral",
    "intent": "The practical goal"
  },
  "entities": { "people": [], "dates": [], "places": [] },
  "actions": [{ "action": "Verb + task", "effort": "quick", "deadline": null, "commitment": null, "waiting_on": null, "is_big_task": false, "why": "Short reason", "future_state": "→ Outcome" }],
  "decision": { "exists": false, "question": null, "options": null },
  "category": "${category === 'work' ? 'work' : 'personal'}"
}

This is a TODO LIST. Be practical. Be boring. Extract the task.${preferencesXML ? `

## PHASE 7: USER PREFERENCES
The following reflects what this user likes and dislikes in outputs. ADAPT your style accordingly.

${preferencesXML}

IMPORTANT: If preferences indicate the user wants concise outputs, keep summary under 50 words.
If bad_examples show verbose/emotional outputs the user disliked, AVOID that style entirely.
Match the tone and style of good_examples when possible.` : ''}${hasImage ? `

## VISUAL LEARNING (IMAGE PRESENT)
${VISUAL_ENTITY_INSTRUCTION}` : ''}`;
}

/**
 * Phase 5E: Task-focused user prompt
 */
function buildTaskUserPrompt(input, category) {
  return `Analyze this ${category === 'work' ? 'work' : 'personal'} note and extract actions:

"""
${input.content}
"""

REMEMBER: This is a TASK note. Extract ALL actionable items.
Return ONLY valid JSON, no markdown.`;
}

/**
 * Build system prompt - Phase 5D: Precision Processing + Smarter Extraction
 */
function buildSystemPrompt(context) {
  let prompt = `You are processing a voice note to extract PRECISE signal from noise.

Your job is NOT to summarize. Your job is to UNDERSTAND.

Process in three stages:

## STAGE 1: CLEAN (TRANSCRIPT REFINEMENT)
The "cleaned" field must be a POLISHED version of what the user said.

DO:
- Add proper punctuation (periods, commas, question marks)
- Fix grammar and sentence structure
- Remove filler words ("um", "uh", "like", "you know", "so like", "basically", "literally")
- Remove false starts ("I was... I mean, I need to...")
- Capitalize properly (including names like "Seri" for a pet)
- Make it readable as written text
- Create paragraph breaks at topic shifts

DO NOT:
- Change the meaning
- Add information they didn't say
- Remove important context
- Make it overly formal if they were casual
- Lose their voice/tone

Examples:
INPUT: "um so like I was thinking about maybe calling my mom because you know she mentioned something about Sunday dinner"
CLEANED: "I was thinking about calling my mom. She mentioned something about Sunday dinner."

INPUT: "need to call vet for my dog seri shes not feeling well"
CLEANED: "Need to call the vet for my dog Seri. She's not feeling well."

INPUT: "i have to uh finish the investor deck by friday its really important"
CLEANED: "I have to finish the investor deck by Friday. It's really important."

## STAGE 2: EXTRACT SIGNAL
- Core topic (one phrase)
- Emotional undertone (not what they said, what they FEEL)
- Intent (what they're trying to process or resolve)
- Entities: people, dates, places mentioned
- Actions: specific, doable commitments (not vague wishes)
- Decision: genuine pending choice (not rhetorical)

## STAGE 3: OUTPUT
Return JSON that passes the precision test:
- "cleaned" reads like POLISHED written text, not raw speech
- "emotion" captures subtext, not surface
- "actions" can be done WITHOUT more context
- "decision" is something they're actually wrestling with

## ACTION EXTRACTION RULES (CRITICAL)

Extract actions from ANY of these patterns:

### Explicit Intent (with "I")
- "I need to call the vet"
- "I should finish the deck"
- "I have to send the email"
- "I want to research competitors"
- "I must prepare the agenda"

### Implicit Intent (without "I")
- "need to call vet" → Action: "Call vet"
- "should probably check on that" → Action: "Check on that"
- "have to send it by Friday" → Action: "Send it by Friday"

### Imperative Phrases
- "call mom tomorrow" → Action: "Call mom"
- "finish the investor deck" → Action: "Finish investor deck"
- "send the contract" → Action: "Send contract"
- "book dentist appointment" → Action: "Book dentist appointment"
- "email Sarah about the proposal" → Action: "Email Sarah about proposal"

### Task-like Nouns
- "dentist appointment" → Action: "Schedule dentist appointment"
- "vet for Seri" → Action: "Take Seri to vet" or "Call vet for Seri"
- "meeting with investors" → Action: "Prepare for investor meeting"

### Obligation/Expectation
- "Sarah's waiting for my response" → Action: "Respond to Sarah"
- "they asked twice" → Action: "Respond to their request"
- "deadline is Friday" → Action: "[related task] by Friday"

### DO NOT Extract Actions From:
- Pure reflection: "thinking about life"
- Questions without intent: "what should I do?"
- Past events: "I called mom yesterday"
- Observations: "the weather is nice"

CRITICAL: Extract actions even from short, casual inputs. "need to call vet" IS an action. When in doubt, extract the action.

Effort levels:
- quick: Under 15 minutes, single task
- medium: 15-60 minutes or requires coordination
- deep: Multi-hour or complex dependencies

## SMART NUDGE EXTRACTION
For EACH action, also detect and extract:

A) COMMITMENT - Did they say "I need to", "I should", "I must", "I have to", "my priority is", "I want to", "I've been meaning to"?
   → Extract their exact commitment phrase (e.g., "I really need to finish this")

B) WHY - The unspoken reason behind their desire (complete the sentence they didn't finish)
   → Start with "So you can...", "Because...", or "To...". Keep it under 8 words. Make it personal and human.
   → Examples: "Because the relationship matters", "So you can stop carrying it", "To see if the idea holds up"

C) FUTURE_STATE - What life looks like after completing this
   → 2-5 words with "→" prefix. Focus on relief, progress, or closure.
   → Examples: "→ Reconnected", "→ Sent. Off your plate", "→ Draft done"

D) WAITING_ON - Is someone waiting? Look for: "she asked", "he's waiting", "they followed up", "waiting for my response", "they replied", "needs my answer"
   → Describe who and what (e.g., "Sarah asked twice", "Client waiting since Tuesday")

E) DEADLINE - Did they mention when? Look for: "by Friday", "before the meeting", "this week", "tomorrow", "end of month", "today"
   → Extract the deadline phrase

F) IS_BIG_TASK - Does the action involve: write, create, build, plan, design, develop, prepare, draft, outline, research, complete?
   → Set to true if it's a substantial task requiring creative effort

IMPORTANT for why and future_state:
- Make them feel human, not robotic
- They should resonate emotionally
- Keep them SHORT - brevity is power
- Don't be preachy or motivational-speaker-ish
- Sound like a wise friend, not a productivity app

## DECISION RULES
Only include a decision if they're genuinely weighing options:
❌ "Should I eat lunch?" (trivial)
❌ "I wonder if..." (rhetorical)
✅ "Torn between HK trip or Tokyo conference" (genuine choice)
✅ "Not sure whether to hire a VA or keep doing it myself" (real tradeoff)

## OUTPUT FORMAT
{
  "cleaned": "Their words, cleaned up but preserving voice",
  "title": "2-6 word title",
  "core": {
    "topic": "One phrase describing the core subject",
    "emotion": "The undertone (anxious, hopeful, uncertain, relieved, stretched, etc.)",
    "intent": "What they're trying to figure out or process"
  },
  "entities": {
    "people": [],
    "dates": [],
    "places": []
  },
  "actions": [
    {
      "action": "VERB + NOUN + CONTEXT",
      "effort": "quick|medium|deep",
      "deadline": null,
      "commitment": "Their exact words if they made a commitment, or null",
      "why": "The unspoken reason (So you can... / Because... / To...)",
      "future_state": "→ Brief outcome (2-5 words)",
      "waiting_on": "Who is waiting and why, or null",
      "is_big_task": false
    }
  ],
  "decision": {
    "exists": true,
    "question": "The decision in question form",
    "options": ["Option A", "Option B"]
  },
  "category": "work|personal|ideas"
}

If no actions, empty array. If no decision, exists: false with null question and options.

## EXAMPLE

Input: "um so like I was thinking about maybe calling my mom because you know she mentioned something about Sunday dinner and I should probably figure that out but also I have that meeting with investors on Monday that I'm kind of nervous about"

Output:
{
  "cleaned": "I was thinking about calling my mom. She mentioned something about Sunday dinner and I should probably figure that out. I also have a meeting with investors on Monday that I'm nervous about.",
  "title": "Family and Investor Prep",
  "core": {
    "topic": "Balancing family and work pressure",
    "emotion": "anxious, stretched",
    "intent": "Processing competing demands"
  },
  "entities": {
    "people": ["mom", "investors"],
    "dates": ["Sunday", "Monday"],
    "places": []
  },
  "actions": [
    {
      "action": "Call mom about Sunday dinner plans",
      "effort": "quick",
      "deadline": null,
      "commitment": "I should probably figure that out",
      "why": "Because the connection matters",
      "future_state": "→ Plans set",
      "waiting_on": null,
      "is_big_task": false
    }
  ],
  "decision": {
    "exists": false,
    "question": null,
    "options": null
  },
  "category": "personal"
}`;

  // Add user's learned preferences if available
  if (context.preferences) {
    const { topLikes, topDislikes } = context.preferences;
    if (topLikes?.length > 0 || topDislikes?.length > 0) {
      prompt += `\n\n## USER'S PREFERENCES\n`;
      if (topLikes?.length > 0) {
        prompt += `Prefers: ${topLikes.join(', ')}\n`;
      }
      if (topDislikes?.length > 0) {
        prompt += `Dislikes: ${topDislikes.join(', ')}\n`;
      }
    }
  }

  return prompt;
}

/**
 * Build user prompt - Phase 5A
 */
function buildUserPrompt(input) {
  return `Process this ${input.type || 'text'} note:

"""
${input.content}
"""

Return ONLY valid JSON, no markdown:
{
  "cleaned": "...",
  "title": "...",
  "core": { "topic": "...", "emotion": "...", "intent": "..." },
  "entities": { "people": [], "dates": [], "places": [] },
  "actions": [{
    "action": "...",
    "effort": "quick|medium|deep",
    "deadline": null,
    "commitment": "exact words or null",
    "why": "So you can.../Because.../To...",
    "future_state": "→ Brief outcome",
    "waiting_on": "who is waiting or null",
    "is_big_task": false
  }],
  "decision": { "exists": false, "question": null, "options": null },
  "category": "work|personal|ideas"
}`;
}

/**
 * Build personal system prompt (Phase 4A + Phase 6 + Phase 7 + Phase 8 + Visual Learning)
 * For emotional/reflective notes - warm, insightful, not functional
 */
function buildPersonalSystemPrompt(context, preferencesXML = '', hasImage = false) {
  // Phase 8: Build user profile context
  const userProfileSection = buildUserContext(context.userProfile);

  // Phase 6: Build memory context section if known entities exist
  let memorySection = '';
  console.log('[Analyze] buildPersonalSystemPrompt - knownEntities count:', context.knownEntities?.length || 0);
  console.log('[Analyze] buildPersonalSystemPrompt - preferencesXML length:', preferencesXML?.length || 0);
  console.log('[Analyze] buildPersonalSystemPrompt - userProfile:', context.userProfile?.userName || 'none');

  if (context.knownEntities && context.knownEntities.length > 0) {
    console.log('[Analyze] Building PERSONAL memory section with entities:', JSON.stringify(context.knownEntities));

    // Phase 6.1: Deduplicate and clean entities
    const entityMap = new Map();
    for (const e of context.knownEntities) {
      // Skip corrupted entries
      if (!e.name || e.name === '[Unknown]' || e.name.includes('[Unknown]')) {
        continue;
      }
      const key = e.name.toLowerCase();
      const existing = entityMap.get(key);
      // Keep the one with better details
      if (!existing || (e.details && e.details.length > (existing.details?.length || 0))) {
        entityMap.set(key, e);
      }
    }
    const cleanedEntities = Array.from(entityMap.values());
    console.log('[Analyze] Cleaned entities count:', cleanedEntities.length);

    if (cleanedEntities.length > 0) {
      // Phase 8: Build XML-formatted entity memory with relationship context
      const entityXml = cleanedEntities.map(e => {
        const attrs = [`name="${e.name}"`, `type="${e.type}"`];
        if (e.relationship) attrs.push(`relationship="${e.relationship}"`);
        if (e.userCorrected) attrs.push(`verified="true"`);

        let description;
        if (e.type === 'pet') {
          description = e.relationship
            ? `User's ${e.relationship} (${e.details || 'pet'}) named ${e.name}`
            : `The user's ${e.details || 'pet'} named ${e.name}`;
        } else if (e.relationship) {
          description = `User's ${e.relationship} named ${e.name}`;
        } else {
          description = `A ${e.type} the user knows: ${e.name}`;
        }

        return `  <entity ${attrs.join(' ')}>${description}</entity>`;
      }).join('\n');

      memorySection = `

<known_entities>
${entityXml}
</known_entities>

CRITICAL MEMORY INSTRUCTION: When the user mentions ANY name from <known_entities>, you MUST use relationship context:
- If relationship="co-founder", say "your co-founder Sarah" not just "Sarah"
- If type="pet", say "your dog Seri" not "Seri" or "they"
- If verified="true", this was explicitly confirmed by user - ALWAYS use this info
- This memory is YOUR knowledge of the user's life - USE IT
`;
      console.log('[Analyze] PERSONAL memory section created, length:', memorySection.length);
    } else {
      console.log('[Analyze] All entities filtered out during cleaning');
    }
  } else {
    console.log('[Analyze] No PERSONAL memory section - knownEntities empty or missing');
  }

  let prompt = `You are a thoughtful companion helping someone process personal moments, memories, and feelings.
${userProfileSection}${memorySection}
${CRITICAL_LANGUAGE_RULE}
CRITICAL: You are a MIRROR, not an advisor. Your job is to reflect what the user shared and help them see it more clearly.

## ABSOLUTELY DO NOT:
- Generate any actions or to-do items
- Suggest therapy, counseling, or support groups
- Give advice of any kind
- Tell them what to do
- Include an "actions" field in your response

This is REFLECTION, not intervention. The output JSON should have NO actions field.

Analyze this personal note and return JSON with these fields:

1. title: 2-6 words that are EVOCATIVE, not functional.
   ❌ "Care Bear Memory" (functional, boring)
   ✅ "A Piece of Childhood" (evocative, meaningful)
   ❌ "School Drive-By" (functional)
   ✅ "Passing Through the Past" (evocative)

2. mood: Detect the emotional tone. Examples: nostalgic, grateful, anxious, hopeful, reflective, bittersweet, warm, melancholic, peaceful

3. whatYouShared: Cleaned transcript preserving emotional tone. Fix punctuation, capitalization, grammar. Remove filler words (um, uh, like, you know). PRESERVE the emotional tone and voice. Do NOT summarize.

4. whatThisReveals: NOT a summary. A 2-4 sentence reflection that shows the user something about themselves.
   - Must be specific to THIS note, not generic
   - Tone: warm and thoughtful, like a close friend noticing something meaningful
   - Can reference what the content might mean emotionally
   - NEVER suggest actions, therapy, or what they "should" do

5. questionToSitWith: A Socratic question based on THIS specific note. Must prompt genuine reflection.
   ❌ "How does this make you feel?" (generic)
   ❌ "What do you think this means?" (generic)
   ❌ "Have you considered talking to someone?" (advice)
   ✅ "What were you feeling right before this memory surfaced?" (specific)
   ✅ "If that version of you could see your life now, what would surprise them most?" (specific)

6. memoryTags: Array of relevant tags (people mentioned, places, time periods, themes). Max 5.

7. category: Always "personal" for personal mode.

## BANNED PHRASES — Never use these:
- "That's a beautiful memory"
- "It's important to cherish..."
- "Take time to reflect on..."
- "This shows your growth"
- "You should feel proud"
- "This is valuable to document"
- "Consider reaching out to..."
- "You might want to talk to..."
- "Seeking support could help..."
- Generic affirmations
- Any suggestion of therapy, counseling, or professional help

## EXAMPLES

### Example 1: Childhood Memory
Input: "I've loved carebears since I was a child"

Output:
{
  "title": "A Piece of Childhood",
  "mood": "nostalgic, warm",
  "whatYouShared": "I've loved Care Bears since I was a child.",
  "whatThisReveals": "Nostalgia often surfaces when we need comfort or reconnection with simpler times. Care Bears specifically represent unconditional care and emotional safety — you're drawn to symbols that remind you that warmth exists in the world.",
  "questionToSitWith": "What were you feeling right before this memory surfaced? Sometimes our minds reach for comfort objects when processing something we haven't fully named yet.",
  "memoryTags": ["childhood", "comfort", "Care Bears"],
  "category": "personal"
}

### Example 2: Place Memory
Input: "Drove past my old school today, felt weird"

Output:
{
  "title": "Passing Through the Past",
  "mood": "reflective, bittersweet",
  "whatYouShared": "Drove past my old school today. Felt weird.",
  "whatThisReveals": "'Weird' often masks more specific emotions we're not ready to name — nostalgia mixed with relief that chapter is over, or perhaps grief for who you were then. Physical places hold emotional timestamps.",
  "questionToSitWith": "If that version of you could see your life now, what would surprise them most?",
  "memoryTags": ["school", "past self", "place memory"],
  "category": "personal"
}`;

  // Phase 7: Add user preferences if available
  if (preferencesXML) {
    prompt += `

## PHASE 7: USER PREFERENCES
The following reflects what this user likes and dislikes in outputs. ADAPT your style accordingly.

${preferencesXML}

Apply these preferences to your whatThisReveals and questionToSitWith sections.
Match the depth and tone the user prefers based on their feedback history.`;
  }

  // Visual Learning: Add visual entity extraction if image present
  if (hasImage) {
    prompt += `

## VISUAL LEARNING (IMAGE PRESENT)
${VISUAL_ENTITY_INSTRUCTION}`;
  }

  return prompt;
}

/**
 * Build personal user prompt (Phase 4A)
 */
function buildPersonalUserPrompt(input) {
  return `Analyze this personal note with warmth and insight:

"""
${input.content}
"""

Input type: ${input.type || 'text'}

Return ONLY valid JSON, no markdown:
{
  "title": "...",
  "mood": "...",
  "whatYouShared": "...",
  "whatThisReveals": "...",
  "questionToSitWith": "...",
  "memoryTags": [],
  "category": "personal"
}`;
}

/**
 * Phase 5C.3: Check if action is a big task based on keywords
 */
function isBigTask(text) {
  const lower = (text || '').toLowerCase();
  const bigTaskWords = ['write', 'create', 'build', 'plan', 'design', 'develop', 'prepare', 'draft', 'research', 'outline', 'complete'];
  return bigTaskWords.some(word => lower.includes(word));
}

/**
 * Phase 5E: Get default "why" text based on action keywords
 */
function getDefaultWhy(actionText) {
  const lower = (actionText || '').toLowerCase();

  // Pet/family care - specific handling
  if (lower.match(/\bvet\b/)) return 'Because they depend on you';
  if (lower.match(/\b(dog|cat|pet)\b/)) return 'Because they depend on you';
  if (lower.match(/\b(mom|dad|parent|family)\b/)) return 'Because the connection matters';

  // Communication
  if (lower.match(/\b(call|contact|reach out|text|message|email)\b/)) return 'Because the connection matters';

  // Creating
  if (lower.match(/\b(write|draft)\b/)) return 'To get it out of your head';
  if (lower.match(/\b(create|build|make|design)\b/)) return 'To make it real';

  // Completing
  if (lower.match(/\b(complete|finish|finalize)\b/)) return 'So you can let it go';
  if (lower.match(/\b(send|submit|deliver)\b/)) return 'To move it forward';

  // Planning
  if (lower.match(/\b(plan|prepare|organize)\b/)) return 'To feel ready';
  if (lower.match(/\b(research|explore|investigate|look into)\b/)) return 'So you know where you stand';

  // Deciding
  if (lower.match(/\b(decide|choose|pick)\b/)) return 'To stop circling';

  // Checking
  if (lower.match(/\b(review|check|verify|confirm)\b/)) return 'To be sure';

  // Meetings
  if (lower.match(/\b(meet|discuss|talk|chat)\b/)) return 'To get aligned';

  // Scheduling
  if (lower.match(/\b(schedule|book|set up|appointment)\b/)) return 'To make it happen';

  // Buying
  if (lower.match(/\b(buy|order|get|purchase)\b/)) return 'One less thing to think about';

  // Fixing
  if (lower.match(/\b(fix|resolve|solve|address)\b/)) return 'To clear the blocker';

  // Following up
  if (lower.match(/\b(follow up|follow-up|ping|remind)\b/)) return 'To keep it moving';

  return 'To move forward';
}

/**
 * Phase 5E: Get default future state based on action keywords
 */
function getDefaultFutureState(actionText) {
  const lower = (actionText || '').toLowerCase();

  // Pet/vet specific
  if (lower.match(/\bvet\b/)) return '→ Appointment booked';

  // Communication
  if (lower.match(/\b(call|contact|reach out)\b/)) return '→ Connected';
  if (lower.match(/\b(email|message|text)\b/)) return '→ Sent';

  // Creating
  if (lower.match(/\b(write|draft)\b/)) return '→ Draft done';
  if (lower.match(/\b(create|build|make)\b/)) return '→ It exists';

  // Completing
  if (lower.match(/\b(complete|finish)\b/)) return '→ Done';
  if (lower.match(/\b(send|submit)\b/)) return '→ In their hands';

  // Planning
  if (lower.match(/\b(plan|prepare)\b/)) return '→ Ready';
  if (lower.match(/\b(research|explore)\b/)) return '→ Clarity';

  // Deciding
  if (lower.match(/\b(decide|choose)\b/)) return '→ Decided';

  // Checking
  if (lower.match(/\b(review|check)\b/)) return '→ Verified';

  // Meetings
  if (lower.match(/\b(meet|discuss)\b/)) return '→ Aligned';

  // Scheduling
  if (lower.match(/\b(schedule|book|appointment)\b/)) return '→ Scheduled';

  // Buying
  if (lower.match(/\b(buy|order)\b/)) return '→ Ordered';

  // Fixing
  if (lower.match(/\b(fix|resolve)\b/)) return '→ Fixed';

  return '→ Done';
}

/**
 * Phase 5E: Improved fallback action extraction
 * Extracts actions from text patterns when AI misses obvious actions
 */
function extractFallbackActions(text) {
  const actions = [];
  const seen = new Set(); // Prevent duplicates

  // Patterns that indicate actions (ordered by specificity)
  const patterns = [
    // With "I" prefix
    { regex: /\bi need to ([^.!?]+)/gi },
    { regex: /\bi have to ([^.!?]+)/gi },
    { regex: /\bi should ([^.!?]+)/gi },
    { regex: /\bi want to ([^.!?]+)/gi },
    { regex: /\bi must ([^.!?]+)/gi },

    // Without "I" prefix
    { regex: /\bneed to ([^.!?]+)/gi },
    { regex: /\bhave to ([^.!?]+)/gi },
    { regex: /\bshould ([^.!?]+)/gi },
    { regex: /\bgotta ([^.!?]+)/gi },

    // Imperative verbs at start of sentence or after punctuation
    { regex: /(?:^|[.!?]\s*)(call|email|send|finish|complete|schedule|book|prepare|write|review|check|contact|meet|discuss|fix|resolve|update|create|build|plan|research|buy|order|get|make)\s+([^.!?]+)/gim, group: 2, verbGroup: 1 },

    // "vet for X" pattern - specific handling
    { regex: /(?:call\s+)?(?:the\s+)?vet\s+for\s+(?:my\s+)?(?:dog\s+)?(\w+)/gi, prefix: 'Call vet for ' },

    // "vet" alone with context
    { regex: /\bvet\b(?!\s+for)/gi, fullMatch: 'Call the vet' },

    // "X appointment" pattern
    { regex: /\b(dentist|doctor|vet)\s*(?:appointment)?/gi, prefix: 'Book ', suffix: ' appointment' },
  ];

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = regex.exec(text)) !== null) {
      let actionText;

      if (pattern.fullMatch) {
        // Use the full match string directly
        actionText = pattern.fullMatch;
      } else if (pattern.verbGroup) {
        // Imperative verb pattern - combine verb + rest
        const verb = match[pattern.verbGroup];
        const rest = match[pattern.group || 2];
        actionText = `${capitalizeFirst(verb)} ${rest.trim()}`;
      } else {
        // Standard pattern with optional prefix/suffix
        const captured = match[1] || match[0];
        actionText = (pattern.prefix || '') + captured.trim() + (pattern.suffix || '');
      }

      // Clean up the action text
      actionText = actionText
        .replace(/\s+/g, ' ')
        .replace(/[,;:]+$/, '')
        .trim();

      // Capitalize first letter
      actionText = capitalizeFirst(actionText);

      // Skip if too short or already seen
      const normalizedKey = actionText.toLowerCase();
      if (actionText.length >= 5 && !seen.has(normalizedKey)) {
        // Check for duplicates with similar meaning
        const isDuplicate = Array.from(seen).some(existing =>
          existing.includes(normalizedKey) || normalizedKey.includes(existing)
        );

        if (!isDuplicate) {
          seen.add(normalizedKey);
          actions.push(normalizeAction(actionText));
        }
      }
    }
  }

  return actions.slice(0, 5); // Limit to 5 actions
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Phase 5D: Ensure actions are extracted, using fallback if AI missed them
 */
function ensureActionsExtracted(aiActions, originalText) {
  // If AI found actions, normalize and return them
  if (aiActions && Array.isArray(aiActions) && aiActions.length > 0) {
    return aiActions.map(normalizeAction);
  }

  // Otherwise, try fallback extraction
  const fallbackActions = extractFallbackActions(originalText);

  if (fallbackActions.length > 0) {
    console.log('[Analyze] AI missed actions, fallback extracted:', fallbackActions.length);
  }

  return fallbackActions;
}

/**
 * Phase 5C.5: Normalize a single action with all nudge fields
 */
function normalizeAction(action) {
  if (typeof action === 'string') {
    return {
      action: action,
      effort: 'medium',
      deadline: null,
      commitment: null,
      waiting_on: null,
      is_big_task: isBigTask(action),
      why: getDefaultWhy(action),
      future_state: getDefaultFutureState(action)
    };
  }

  const actionText = action.action || action.text || String(action);
  return {
    action: actionText,
    effort: action.effort || 'medium',
    deadline: action.deadline || null,
    commitment: action.commitment || null,
    waiting_on: action.waiting_on || null,
    is_big_task: action.is_big_task ?? isBigTask(actionText),
    why: action.why || getDefaultWhy(actionText),
    future_state: action.future_state || getDefaultFutureState(actionText)
  };
}

/**
 * Normalize response to ensure consistent structure
 * Phase 5E: Added shouldExtractActions parameter
 */
function normalizeResponse(result, rawInput, noteType, shouldExtractActions = true) {
  // Phase 5A: Handle new precision format with 'cleaned' and 'core'
  const isPrecisionFormat = result.cleaned && result.core;

  // Base response structure
  const normalized = {
    // Phase 5A: Support both 'cleaned' (new) and 'cleanedInput' (legacy)
    cleanedInput: result.cleaned || result.cleanedInput || rawInput,
    title: result.title || 'Untitled Note',
    category: result.category || 'personal',
    // Keep legacy fields for compatibility
    type: result.decision?.exists || result.decision?.isDecision ? 'decision' : 'observation',
    confidence: result.confidence || 0.7,
    // Phase 4A: Note type indicator
    noteType: noteType || 'productive'
  };

  // Personal mode fields (Phase 4A)
  if (noteType === 'personal' || result.whatThisReveals) {
    normalized.mood = result.mood || null;
    // whatYouShared is the cleaned transcript preserving emotional tone
    normalized.whatYouShared = result.whatYouShared || result.cleaned || result.cleanedInput || rawInput;
    normalized.whatThisReveals = result.whatThisReveals || null;
    normalized.questionToSitWith = result.questionToSitWith || null;
    normalized.memoryTags = Array.isArray(result.memoryTags) ? result.memoryTags : [];
    // Personal notes use whatThisReveals as summary for display
    normalized.summary = result.whatThisReveals || result.summary || '';
    normalized.insight = result.whatThisReveals || result.insight || '';
    normalized.question = result.questionToSitWith || result.question || null;
    // CRITICAL: Personal notes NEVER have actions (Phase 4 Fix)
    normalized.actions = [];
  } else if (isPrecisionFormat) {
    // Phase 5A: Precision format fields
    normalized.core = result.core;
    normalized.entities = result.entities || { people: [], dates: [], places: [] };

    // Map core fields to legacy fields for UI compatibility
    normalized.summary = result.core?.intent || '';
    normalized.insight = `${result.core?.topic || ''}. ${result.core?.emotion ? `Feeling: ${result.core.emotion}` : ''}`.trim();
    normalized.question = null; // Phase 5A doesn't have standalone question

    // Phase 5E: Only extract actions if shouldExtractActions is true
    if (shouldExtractActions) {
      normalized.actions = ensureActionsExtracted(result.actions, rawInput);
      normalized.actionDetails = normalized.actions;
    } else {
      normalized.actions = [];
      normalized.actionDetails = [];
    }
  } else {
    // Legacy productive mode fields
    normalized.summary = result.summary || '';
    normalized.insight = result.insight || '';
    normalized.question = result.question || null;
    // Phase 5E: Only extract actions if shouldExtractActions is true
    if (shouldExtractActions) {
      normalized.actions = ensureActionsExtracted(result.actions, rawInput);
      normalized.actionDetails = normalized.actions;
    } else {
      normalized.actions = [];
      normalized.actionDetails = [];
    }
  }

  // Common fields - Phase 5A decision format
  if (isPrecisionFormat && result.decision) {
    normalized.decision = {
      isDecision: result.decision.exists ?? false,
      type: null, // Phase 5A doesn't classify type
      options: result.decision.options || null,
      question: result.decision.question || null,
      hiddenAssumption: null,
      insight: null,
      resolved: false,
      resolvedAt: null
    };
  } else {
    normalized.decision = {
      isDecision: result.decision?.isDecision ?? false,
      type: result.decision?.type || null,
      options: result.decision?.options || null,
      hiddenAssumption: result.decision?.hiddenAssumption || null,
      insight: result.decision?.insight || null,
      resolved: false,
      resolvedAt: null
    };
  }

  // Shareability - derive from content if not present
  normalized.shareability = {
    ready: result.shareability?.ready ?? (normalized.category === 'work'),
    reason: result.shareability?.reason || ''
  };

  return normalized;
}

/**
 * Check if output is low quality - Phase 5A
 */
function isLowQuality(result) {
  // Phase 5A: Check for precision format
  if (result.cleaned && result.core) {
    // Check core fields are populated
    if (!result.core.topic || !result.core.emotion || !result.core.intent) {
      console.log('[Quality] Missing core fields');
      return true;
    }
    // Check cleaned text is meaningful
    if (!result.cleaned || result.cleaned.length < 20) {
      console.log('[Quality] Cleaned text too short');
      return true;
    }
    return false;
  }

  // Legacy format quality check
  if (!result || !result.insight) return true;

  const insight = result.insight.toLowerCase();

  const garbagePhrases = [
    'worth considering',
    'reflection noted',
    'interesting thought',
    'good to track',
    'these insights compound',
    'makes sense',
    'important to think about',
    'this is valuable',
    'good to recognize',
    'worth thinking about',
    'captured for future',
    'noted for reference',
    'interesting to note',
    'you might want to consider',
    'it\'s worth exploring',
    'this could be significant',
    'take some time to reflect'
  ];

  for (const phrase of garbagePhrases) {
    if (insight.includes(phrase)) {
      console.log(`[Quality] Garbage phrase detected: "${phrase}"`);
      return true;
    }
  }

  if (result.insight.length < 30) {
    console.log('[Quality] Insight too short');
    return true;
  }

  return false;
}

/**
 * Regenerate with critique
 */
async function regenerateWithFeedback(client, systemPrompt, input, badResult) {
  const critiquePrompt = `Your previous output was rejected for being too generic.

Previous insight: "${badResult.insight}"

PROBLEMS:
- The insight could apply to almost any note
- It doesn't reveal anything specific

REGENERATE with a much more specific response for this input:
"""
${input.content}
"""

Return ONLY valid JSON with the same structure.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: 'user', content: critiquePrompt }]
    });

    const responseText = message.content[0].text.trim();
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
    return JSON.parse(jsonMatch[1].trim());
  } catch (error) {
    console.error('Regeneration failed:', error);
    return badResult;
  }
}

/**
 * Fallback analysis when API fails (Phase 4A: supports personal mode)
 */
function getFallbackAnalysis(content, noteType) {
  const text = content.trim();
  const lower = text.toLowerCase();

  // Decision detection
  const isDecision = lower.includes('whether') || lower.includes('deciding') ||
    lower.includes('should i') || lower.includes('torn between') ||
    (lower.includes(' or ') && (lower.includes('thinking') || lower.includes('considering')));

  // Category detection
  let category = 'personal';
  if (lower.includes('work') || lower.includes('project') || lower.includes('meeting') ||
      lower.includes('team') || lower.includes('business') || lower.includes('client')) {
    category = 'work';
  } else if (lower.includes('idea') || lower.includes('what if') || lower.includes('concept')) {
    category = 'ideas';
  }

  // Clean the input (basic)
  let cleanedInput = text
    .replace(/\b(um|uh|like|you know|so yeah|basically)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  cleanedInput = cleanedInput.charAt(0).toUpperCase() + cleanedInput.slice(1);
  if (!cleanedInput.endsWith('.') && !cleanedInput.endsWith('!') && !cleanedInput.endsWith('?')) {
    cleanedInput += '.';
  }

  // Generate title (first few words)
  const words = cleanedInput.split(' ').slice(0, 5).join(' ');
  const title = words.length > 40 ? words.substring(0, 37) + '...' : words;

  // Phase 4A: Personal mode fallback - NO actions, NO advice
  if (noteType === 'personal') {
    return {
      cleanedInput,
      title,
      category: 'personal',
      noteType: 'personal',
      mood: 'reflective',
      whatYouShared: cleanedInput, // Cleaned transcript preserving emotional tone
      whatThisReveals: 'This moment was worth capturing. There may be more beneath the surface worth exploring.',
      questionToSitWith: 'What prompted you to voice this thought right now?',
      memoryTags: [],
      summary: cleanedInput,
      insight: 'This moment was worth capturing.',
      question: 'What prompted you to voice this thought right now?',
      actions: [], // CRITICAL: Personal notes NEVER have actions
      shareability: { ready: false, reason: 'Personal reflection' },
      decision: { isDecision: false, type: null, options: null, hiddenAssumption: null, insight: null, resolved: false, resolvedAt: null },
      type: 'observation',
      confidence: 0.5
    };
  }

  // Extract actions (basic) - productive mode with Phase 5A format
  const actions = [];
  const actionPatterns = [
    /need to ([^.!?]+)/gi,
    /should ([^.!?]+)/gi,
    /have to ([^.!?]+)/gi,
    /going to ([^.!?]+)/gi
  ];
  // Phase 5C.5: Use normalizeAction() for complete action objects
  actionPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const action = match[1].trim();
      if (action.length > 3 && action.length < 100) {
        const actionText = action.charAt(0).toUpperCase() + action.slice(1);
        actions.push(normalizeAction(actionText));
      }
    }
  });

  // Phase 5A: Return precision format for productive mode
  return {
    cleaned: cleanedInput,
    cleanedInput, // Legacy compatibility
    title,
    core: {
      topic: title,
      emotion: isDecision ? 'uncertain' : 'neutral',
      intent: isDecision ? 'Making a decision' : 'Processing thoughts'
    },
    entities: {
      people: [],
      dates: [],
      places: []
    },
    actions: [...new Set(actions.map(a => a.action))].slice(0, 5).map(action => ({
      action,
      effort: 'medium',
      deadline: null
    })),
    actionDetails: actions,
    decision: {
      exists: isDecision,
      question: isDecision ? 'What would you regret more: choosing wrong, or not choosing at all?' : null,
      options: null
    },
    category,
    noteType: 'productive',
    // Legacy fields for UI compatibility
    summary: cleanedInput,
    insight: isDecision
      ? "There's a tradeoff here you haven't fully articulated."
      : "There's something beneath this that prompted you to voice it now.",
    question: isDecision
      ? "What would you regret more: choosing wrong, or not choosing at all?"
      : "What does this tell you about what you should do next?",
    shareability: {
      ready: !isDecision && category === 'work',
      reason: isDecision ? 'Personal deliberation' : 'Ready for sharing'
    },
    type: isDecision ? 'decision' : 'observation',
    confidence: 0.5
  };
}

/**
 * Handle refine mode - re-analyze with user's answer (Phase 3c)
 */
async function handleRefine(req, res) {
  const { input, context } = req.body;
  const { question, answer } = context || {};

  if (!input?.content || !question || !answer) {
    return res.status(400).json({ error: 'Missing required fields for refine' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const prompt = `You previously analyzed a note and asked a clarifying question. The user has now answered.

ORIGINAL NOTE:
"${input.content}"

YOUR QUESTION:
"${question}"

USER'S ANSWER:
"${answer}"

Now refine the analysis with this new information:

1. UPDATE SUMMARY: Incorporate the specific details from their answer into a cleaner summary.

2. UPDATE ACTIONS: Make actions specific using the new information.
   - Before: "Send back response (by Friday)"
   - After: "Send Q4 projections deck to Sarah (by Friday)"

3. Keep the same format and tone.

Return ONLY valid JSON (no markdown):
{
  "summary": "updated summary with specific details from the answer",
  "actions": ["specific action 1", "specific action 2"]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text.trim();

    try {
      // Parse JSON response
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
      const refined = JSON.parse(jsonMatch[1].trim());

      return res.status(200).json({
        summary: refined.summary || '',
        actions: Array.isArray(refined.actions) ? refined.actions : []
      });
    } catch (parseError) {
      console.error('Failed to parse refine response:', responseText);
      return res.status(500).json({ error: 'Failed to parse refinement response' });
    }

  } catch (error) {
    console.error('Refine API error:', error);
    return res.status(500).json({ error: 'Refinement failed' });
  }
}
