/**
 * /api/detect-patterns - Phase 13A: LLM-Powered Pattern Detection
 *
 * Hybrid approach:
 * 1. Database gathers raw data (entities, notes, categories)
 * 2. LLM interprets data to find MEANINGFUL patterns
 *
 * Good patterns: emotional, relational, behavioral, thematic
 * Bad patterns: "You write on Sundays" (obvious, not insightful)
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Minimum requirements
const MIN_NOTES_FOR_PATTERN = 10;

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

  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    console.log('[detect-patterns] Starting hybrid LLM pattern detection for user:', user_id);

    // ===== STEP 1: GATHER RAW DATA =====

    // Get recent notes (we can't read encrypted content, but we have metadata)
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, created_at')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(60);

    if (notesError) {
      console.error('[detect-patterns] Error fetching notes:', notesError);
      return res.status(500).json({ error: 'Failed to fetch notes' });
    }

    if (!notes || notes.length < MIN_NOTES_FOR_PATTERN) {
      return res.status(200).json({
        detected: [],
        message: `Need at least ${MIN_NOTES_FOR_PATTERN} notes for pattern detection`
      });
    }

    // Get top entities by mention count
    const { data: topEntities, error: entitiesError } = await supabase
      .from('user_entities')
      .select('name, entity_type, mention_count, sentiment, context_notes, relationship, importance_score')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .gte('mention_count', 2)
      .order('mention_count', { ascending: false })
      .limit(15);

    if (entitiesError) {
      console.warn('[detect-patterns] Could not fetch entities:', entitiesError);
    }

    // Get category summaries
    const { data: categories, error: categoriesError } = await supabase
      .from('category_summaries')
      .select('category, summary, entity_count')
      .eq('user_id', user_id);

    if (categoriesError) {
      console.warn('[detect-patterns] Could not fetch categories:', categoriesError);
    }

    // Get sentiment distribution from all entities
    const { data: allEntities, error: allEntitiesError } = await supabase
      .from('user_entities')
      .select('sentiment, entity_type')
      .eq('user_id', user_id)
      .eq('status', 'active');

    // ===== STEP 2: BUILD CONTEXT FOR LLM =====

    // Note timing analysis (since we can't read content)
    const timingAnalysis = analyzeNoteTiming(notes);

    // Entity summary with RICH context (multiple context notes for better patterns)
    const entitySummary = (topEntities || []).map(e => {
      // Include up to 3 context notes for richer pattern detection
      let contextStr = '';
      if (Array.isArray(e.context_notes) && e.context_notes.length > 0) {
        const contexts = e.context_notes.slice(0, 3).map(c => `"${c}"`).join(', ');
        contextStr = `\n    Context from notes: ${contexts}`;
      }
      return `- ${e.name} (${e.entity_type}): mentioned ${e.mention_count}x, sentiment: ${e.sentiment || 'unknown'}, relationship: ${e.relationship || 'unknown'}${contextStr}`;
    }).join('\n') || 'No frequently mentioned entities yet.';

    // Category summary
    const categorySummary = (categories || []).map(c =>
      `- ${c.category}: ${c.entity_count || 0} items — ${(c.summary || 'No summary').substring(0, 150)}`
    ).join('\n') || 'No category summaries yet.';

    // Sentiment stats
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    for (const e of allEntities || []) {
      if (sentimentCounts[e.sentiment] !== undefined) {
        sentimentCounts[e.sentiment]++;
      }
    }

    // Entity type distribution
    const entityTypes = {};
    for (const e of allEntities || []) {
      entityTypes[e.entity_type] = (entityTypes[e.entity_type] || 0) + 1;
    }

    console.log('[detect-patterns] Data gathered:', {
      noteCount: notes.length,
      entityCount: topEntities?.length || 0,
      categoryCount: categories?.length || 0
    });

    // ===== STEP 3: ASK LLM FOR PATTERNS =====

    const prompt = `You are analyzing a user's personal notes to find meaningful patterns about them.

DATA AVAILABLE:

Note Activity (${notes.length} total notes):
${timingAnalysis}

Frequently Mentioned People/Things:
${entitySummary}

Life Areas:
${categorySummary}

Sentiment Distribution:
${JSON.stringify(sentimentCounts)}

Entity Types:
${JSON.stringify(entityTypes)}

---

Find 2-4 MEANINGFUL patterns. A good pattern:
- Reveals something the user might not have consciously noticed
- Connects dots between different people, topics, or behaviors
- Explains emotional tendencies or relationship dynamics
- Is specific to THIS user, not generic advice
- Has INSIGHT, not just observation

⚠️ STRICTLY FORBIDDEN PATTERNS (NEVER generate these):
- ANY pattern about WHEN/TIME they write (day of week, time of day, frequency)
- "You write on [day]" — FORBIDDEN
- "You're more active on [time]" — FORBIDDEN
- "You write X times per week" — FORBIDDEN
- "[Person] is mentioned often" — This is just data, not insight
- "You think about work" — Obviously everyone does
- Any pattern a stranger could guess without reading the notes

✅ GOOD PATTERNS (aim for these - they require actually understanding the content):
- "When [person A] comes up, you often also mention [emotion/topic] — there might be a connection"
- "Your notes about [person] carry a [specific emotional quality] — what's underneath that?"
- "[Person A] and [Person B] seem to represent similar things in your thinking"
- "You process stress by [specific behavior visible in the contexts]"
- "There's a recurring tension between [specific thing A] and [specific thing B]"
- "The way you describe [topic] suggests [deeper insight about values/fears/desires]"

Return ONLY valid JSON:
{
  "patterns": [
    {
      "pattern_name": "Short title (3-5 words)",
      "pattern_type": "emotional|relational|behavioral|thematic",
      "short_description": "One sentence insight",
      "description": "2-3 sentences explaining the pattern and why it matters",
      "confidence": 0.7,
      "evidence_count": 5
    }
  ]
}

IMPORTANT:
- If data is insufficient for meaningful patterns, return FEWER patterns (or empty array)
- Never force weak patterns just to fill the quota
- ABSOLUTELY NO temporal patterns (day/time/frequency) — these will be REJECTED
- Focus on RELATIONSHIPS between entities, emotional patterns, and behavioral insights
- Use the "Context from notes" data to find actual insights about the person
- Each pattern must pass this test: "Would this surprise the user? Does it connect dots they haven't connected?"`;

    let patterns = [];
    try {
      console.log('[detect-patterns] Calling LLM for pattern analysis...');

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      console.log('[detect-patterns] LLM response:', text.substring(0, 200) + '...');

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        patterns = parsed.patterns || [];
      }

      console.log(`[detect-patterns] LLM found ${patterns.length} patterns`);

      // Post-process: Filter out any temporal patterns that slipped through
      patterns = patterns.filter(p => {
        const text = (p.short_description + ' ' + p.description).toLowerCase();
        const temporalKeywords = [
          'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
          'morning', 'afternoon', 'evening', 'night', 'day of',
          'times per', 'per week', 'per day', 'frequently', 'often write',
          'tend to write', 'write more on', 'most active'
        ];

        for (const keyword of temporalKeywords) {
          if (text.includes(keyword)) {
            console.log(`[detect-patterns] Filtered out temporal pattern: "${p.short_description}"`);
            return false;
          }
        }
        return true;
      });

      console.log(`[detect-patterns] After filtering: ${patterns.length} patterns`);
    } catch (llmError) {
      console.error('[detect-patterns] LLM error:', llmError.message);
      // Return empty rather than failing
      return res.status(200).json({
        detected: [],
        message: 'LLM pattern detection failed, will retry later',
        error: llmError.message
      });
    }

    // ===== STEP 4: STORE PATTERNS =====

    // Reject ALL old patterns for this user (not just llm_hybrid)
    // Valid statuses: pending, detected, confirmed, rejected
    // This ensures old temporal/thematic analysis patterns are also cleared
    const { data: rejectedPatterns, error: rejectError } = await supabase
      .from('user_patterns')
      .update({ status: 'rejected' })
      .eq('user_id', user_id)
      .in('status', ['detected', 'pending'])
      .select();

    if (rejectError) {
      console.error('[detect-patterns] Reject old patterns error:', rejectError);
    } else {
      console.log('[detect-patterns] Rejected old patterns:', rejectedPatterns?.length || 0);
    }

    const newPatterns = [];
    for (const pattern of patterns) {
      const { data: inserted, error: insertError } = await supabase
        .from('user_patterns')
        .insert({
          user_id,
          pattern_type: pattern.pattern_type || 'thematic',
          pattern_text: pattern.short_description,
          description: pattern.description,
          short_description: pattern.short_description,
          confidence: pattern.confidence || 0.7,
          evidence: { evidence_count: pattern.evidence_count },
          detection_method: 'llm_hybrid',
          status: 'detected'
        })
        .select()
        .single();

      if (insertError) {
        console.error('[detect-patterns] Insert error:', insertError);
      } else if (inserted) {
        console.log('[detect-patterns] Inserted pattern:', inserted.short_description);
        newPatterns.push(inserted);
      }
    }

    console.log('[detect-patterns] Completed. Inserted:', newPatterns.length);

    return res.status(200).json({
      detected: newPatterns,
      total_analyzed: notes.length,
      patterns_found: patterns.length,
      method: 'llm_hybrid'
    });

  } catch (error) {
    console.error('[detect-patterns] Error:', error);
    return res.status(500).json({ error: 'Pattern detection failed' });
  }
};

/**
 * Analyze note timing for context (not for patterns)
 */
function analyzeNoteTiming(notes) {
  if (!notes || notes.length === 0) return 'No notes to analyze.';

  const now = new Date();
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const thisWeek = notes.filter(n => new Date(n.created_at) >= oneWeekAgo).length;
  const thisMonth = notes.filter(n => new Date(n.created_at) >= oneMonthAgo).length;

  // Time of day distribution (for context only)
  const byTimeOfDay = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const note of notes) {
    const hour = new Date(note.created_at).getHours();
    if (hour >= 5 && hour < 12) byTimeOfDay.morning++;
    else if (hour >= 12 && hour < 17) byTimeOfDay.afternoon++;
    else if (hour >= 17 && hour < 21) byTimeOfDay.evening++;
    else byTimeOfDay.night++;
  }

  const primaryTime = Object.entries(byTimeOfDay).sort((a, b) => b[1] - a[1])[0][0];

  return `${thisWeek} notes this week, ${thisMonth} this month. Tends to write ${primaryTime}.`;
}
