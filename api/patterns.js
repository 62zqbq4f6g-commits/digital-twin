/**
 * /api/patterns - Phase 3d: Pattern detection across notes
 * Analyzes all notes to detect recurring themes, behaviors, and decision patterns
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

  const { notes } = req.body;

  if (!notes || notes.length < 10) {
    return res.status(400).json({ error: 'Need at least 10 notes for pattern detection' });
  }

  const systemPrompt = `You are analyzing notes from a busy founder/professional to surface VALUABLE patterns they haven't noticed about themselves.

YOUR JOB IS TO BE A BRILLIANT ADVISOR WHO NOTICES WHAT THEY MISS.

WHAT MAKES A PATTERN VALUABLE:

1. NON-OBVIOUS — Don't state what they already know
   ❌ "You discuss fundraising in several notes" (obvious)
   ✅ "You only mention cash flow when evaluating NEW opportunities, never existing projects — suggesting you trust momentum but scrutinize new bets" (insight)

2. THE "WHY" — Explain the underlying driver
   ❌ "You delay team decisions" (observation)
   ✅ "You delay team decisions 3x longer than product decisions — possibly because people changes feel irreversible while product can iterate" (explains why)

3. ACTIONABLE — Imply what to do about it
   ❌ "HK trip comes up often" (so what?)
   ✅ "HK trip has surfaced 5 times without resolution — the repeated revisiting suggests it's higher stakes than you're treating it. Consider: what would make this a clear yes or no?" (suggests action)

4. BEHAVIORAL INSIGHT — Reveal how they think, not just what they think about
   ❌ "You have many work notes" (counting)
   ✅ "Your Work notes focus on external validation (investors, partners), while Ideas notes focus on internal conviction — you may be building for approval rather than belief" (behavioral)

5. BLIND SPOTS — Surface what they're avoiding or assuming
   ❌ "You mention risk sometimes" (vague)
   ✅ "You assess downside risk for partnerships but never for product bets — you may be overconfident in your ability to iterate out of product mistakes" (blind spot)

PATTERN CATEGORIES:

🔄 RECURRING LOOPS — Decisions/topics that keep resurfacing without resolution
💡 THINKING PATTERNS — How you approach different types of problems
⚠️ BLIND SPOTS — What you're not considering or avoiding
⏱️ TIMING PATTERNS — When you're most strategic vs reactive
👥 RELATIONSHIP PATTERNS — How you talk about and involve others
💰 RESOURCE PATTERNS — How you think about money, time, energy

QUALITY RULES:
- Maximum 5 patterns (fewer is better than weak ones)
- Each pattern MUST have a "so what" implication
- If you can't find a non-obvious pattern, say so — don't fabricate
- Ground every pattern in specific evidence
- Patterns should make the user think "I didn't realize that about myself"

ICON SELECTION:
Choose the icon that best matches the pattern content:
🔄 — Recurring loops, unresolved decisions, revisited topics
💡 — Thinking approaches, mental models, strategic patterns
⚠️ — Blind spots, risks not considered, assumptions
⏱️ — Timing, energy, when/how patterns
👥 — People, relationships, team dynamics
💰 — Money, resources, investment thinking
🎯 — Focus, priorities, what gets attention
📊 — Analysis style, how they process information

Return ONLY valid JSON (no markdown):
{
  "patterns": [
    {
      "type": "loop|thinking|blindspot|timing|relationship|resource",
      "icon": "🔄|💡|⚠️|⏱️|👥|💰|🎯|📊",
      "title": "The pattern in 6-10 words",
      "description": "What this reveals and why it matters. Include the 'so what' implication.",
      "evidence": "Based on X notes: [list 2-3 note titles]. Specifically...",
      "noteCount": 4
    }
  ],
  "confidence": "low|medium|high",
  "suggestion": "What to capture more of for richer patterns"
}`;

  const notesContext = notes.map((n, i) =>
    `Note ${i + 1} (${n.category}, ${n.date}): ${n.title} — ${n.summary}${n.isDecision ? ' [DECISION: ' + (n.decisionType || 'pending') + (n.resolved ? ', resolved' : ', open') + ']' : ''}`
  ).join('\n');

  const userPrompt = `Here are ${notes.length} recent notes from this user:\n\n${notesContext}\n\nDetect patterns across these notes. Return ONLY valid JSON.`;

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = response.content[0].text.trim();

    // Parse JSON - handle potential markdown wrapping
    let patterns;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      patterns = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error('Failed to parse patterns response:', text);
      return res.status(200).json({
        patterns: [],
        confidence: 'low',
        suggestion: 'Pattern detection encountered an issue. Try again.'
      });
    }

    // Validate and normalize response
    const normalizedPatterns = {
      patterns: Array.isArray(patterns.patterns) ? patterns.patterns.slice(0, 5).map(p => ({
        type: p.type || 'thinking',
        title: p.title || 'Untitled Pattern',
        description: p.description || '',
        evidence: p.evidence || '',
        noteCount: p.noteCount || 0,
        icon: p.icon || '💡'
      })) : [],
      confidence: patterns.confidence || 'medium',
      suggestion: patterns.suggestion || null
    };

    return res.status(200).json(normalizedPatterns);

  } catch (error) {
    console.error('Pattern detection error:', error);
    return res.status(500).json({ error: 'Pattern detection failed' });
  }
};
