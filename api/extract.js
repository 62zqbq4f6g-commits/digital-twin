/**
 * /api/extract - Extract entities and beliefs from note text using Claude
 */

const Anthropic = require('@anthropic-ai/sdk');

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

  const { text, existing_entities = [], type } = req.body;

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: 'Text too short' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const systemPrompt = `You are an entity and belief extraction system for a personal knowledge base.

Extract the following from the user's note:

1. ENTITIES:
   - people: Names of people mentioned (with relationship context if clear)
   - projects: Work projects, side projects, products mentioned
   - companies: Companies, organizations, startups mentioned
   - topics: Subject areas, industries, technologies discussed

2. BELIEFS (if type includes beliefs):
   - opinions: Stances on topics with confidence level
   - values: Personal values expressed
   - contrarian: Views that go against conventional wisdom

For each entity, include:
- name: The entity name
- type: person, project, company, or topic
- sentiment: positive, negative, or neutral (based on how it's discussed)
- For people: relationship (friend, colleague, mentor, etc.) if determinable
- For projects: status (active, completed, mentioned) if determinable
- For topics: depth (0-1, how deeply they seem to know it)

For beliefs:
- topic: What the belief is about
- stance: bullish, bearish, or neutral
- confidence: 0-1 based on language strength
- quote: The relevant text

Respond ONLY with valid JSON in this exact format:
{
  "entities": [
    { "type": "person", "name": "Name", "sentiment": "positive", "relationship": "colleague" },
    { "type": "project", "name": "Project Name", "sentiment": "positive", "status": "active" },
    { "type": "company", "name": "Company", "sentiment": "neutral", "relationship": "mentioned" },
    { "type": "topic", "name": "Topic", "sentiment": "bullish", "depth": 0.7 }
  ],
  "beliefs": [
    { "topic": "Topic", "stance": "bullish", "confidence": 0.8, "quote": "relevant text" }
  ],
  "patterns": {
    "sentiment": "positive",
    "energy": 0.7,
    "actionOriented": true
  }
}

If no entities or beliefs found, return empty arrays. Do not include explanations.`;

    const existingContext = existing_entities.length > 0
      ? `\n\nAlready known entities (avoid duplicates): ${existing_entities.join(', ')}`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Extract entities and beliefs from this note:${existingContext}

---
${text}
---

Remember: Respond ONLY with valid JSON, no explanations.`
        }
      ],
      system: systemPrompt
    });

    // Parse response
    const responseText = message.content[0].text.trim();

    // Try to extract JSON from response
    let result;
    try {
      // Handle potential markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                        [null, responseText];
      result = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      // Return empty result if parsing fails
      result = {
        entities: [],
        beliefs: [],
        patterns: { sentiment: 'neutral', energy: 0.5, actionOriented: false }
      };
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Extract API error:', error);

    // Return empty result on error
    return res.status(200).json({
      entities: [],
      beliefs: [],
      patterns: { sentiment: 'neutral', energy: 0.5, actionOriented: false },
      error: 'Extraction failed, using fallback'
    });
  }
};
