// api/vision.js — Vercel Serverless Function for Claude Vision
// Processes images with OCR and description generation

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

${context ? `User context: "${context}"` : ''}

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "title": "Brief descriptive title (max 50 chars)",
  "description": "What the image shows (1-2 sentences)",
  "extracted_text": "Any text visible in the image (OCR). Empty string if no text.",
  "category": "work|personal|health|ideas",
  "confidence": 0.8,
  "summary": "Professional 2-3 sentence summary of the image content",
  "topics": ["topic1", "topic2"],
  "action_items": ["action if any visible tasks/todos"],
  "people": ["names if any visible"],
  "sentiment": "positive|neutral|negative"
}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude Vision API error:', error);
      return res.status(500).json({ error: 'Vision API request failed' });
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

    return res.status(200).json(result);

  } catch (error) {
    console.error('Vision handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
