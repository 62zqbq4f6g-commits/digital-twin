// api/vision.js — Vercel Serverless Function for Claude Vision
// Processes images with OCR and description generation

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

This rule applies to: title, description, summary, action_items, and ALL text output.
`;

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

  try {
    const { image, context } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return res.status(500).json({ error: 'API not configured' });
    }

    // Extract base64 data (remove data:image/...;base64, prefix)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    // Log image size for debugging
    console.log('[Vision] Image size:', Math.round(base64Data.length / 1024), 'KB, mediaType:', mediaType);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              },
              {
                type: 'text',
                text: `Analyze this image and extract information for a personal note-taking system.

${CRITICAL_LANGUAGE_RULE}

${context ? `User's voice/text caption: "${context}"` : ''}

RELATIONSHIP EXTRACTION:
When the user uses possessive language like "my dog", "my mom", "my co-founder", capture this relationship in the entities array.
- "my dog Seri" → entity with relationship_to_user: "my dog"
- "my co-founder John" → entity with relationship_to_user: "my co-founder"
- "my sister" → entity with relationship_to_user: "my sister"

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "title": "Brief descriptive title (max 50 chars) - use 'your' not 'the user's'",
  "description": "What the image shows (1-2 sentences) - use second-person language",
  "extracted_text": "Any text visible in the image (OCR). Empty string if no text.",
  "cleaned_context": "${context ? 'Clean up the user caption with proper punctuation, grammar, and capitalization. Keep their voice and meaning.' : ''}",
  "category": "work|personal|health|ideas",
  "confidence": 0.8,
  "summary": "Professional 2-3 sentence summary - MUST use 'your' not 'the user's'",
  "topics": ["topic1", "topic2"],
  "action_items": ["action if any visible tasks/todos - use 'your' not 'the user's'"],
  "entities": [
    {"name": "EntityName", "type": "person|pet|place|project", "relationship_to_user": "extracted possessive phrase like 'my dog' or 'my sister'"}
  ],
  "people": ["names if any visible or mentioned"],
  "sentiment": "positive|neutral|negative"
}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vision] Claude API error status:', response.status);
      console.error('[Vision] Claude API error body:', errorText);
      // Return detailed error to client for debugging
      return res.status(500).json({
        error: 'Vision API request failed',
        status: response.status,
        details: errorText.substring(0, 500) // Limit error length
      });
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    // Parse JSON response
    let result;
    try {
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      result = {
        title: 'Image Capture',
        description: content,
        extracted_text: '',
        category: 'personal',
        confidence: 0.5,
        summary: content,
        topics: [],
        action_items: [],
        people: [],
        sentiment: 'neutral'
      };
    }

    // Generate formatted output
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) + ' SGT';

    const categoryIcons = {
      personal: '🏠 Personal',
      work: '💼 Work',
      health: '💪 Health',
      ideas: '💡 Idea'
    };

    const categoryLabel = categoryIcons[result.category] || '📷 Image';

    let formattedOutput = `# ${result.title}

**${dateStr}**
**${timeStr}**
**${categoryLabel}**

---

## Description

${result.description}

---`;

    if (result.extracted_text) {
      formattedOutput += `

## Extracted Text

${result.extracted_text}

---`;
    }

    if (result.action_items && result.action_items.length > 0) {
      formattedOutput += `

## Action Items

${result.action_items.map(item => `☐ ${item}`).join('\n')}

---`;
    }

    formattedOutput += `

*Captured by Digital Twin*`;

    result.formatted_output = formattedOutput;

    // Include original context in response
    result.original_context = context || '';

    return res.status(200).json(result);

  } catch (error) {
    console.error('Vision handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
