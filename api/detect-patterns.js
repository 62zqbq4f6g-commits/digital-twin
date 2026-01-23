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

    // Entity summary with context
    const entitySummary = (topEntities || []).map(e => {
      const contextStr = Array.isArray(e.context_notes) && e.context_notes.length > 0
        ? ` — recent context: "${e.context_notes[0]}"`
        : '';
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

BAD patterns (NEVER output these):
- "You write notes on Sundays" — temporal patterns about WHEN they write are BORING
- "You mention [person] often" — just restating the data, not insight
- "You have work notes" — obvious from categories
- Generic observations that could apply to anyone

GOOD patterns (aim for these):
- "When you write about [X], [Y] often comes up too — there might be a connection you haven't explored"
- "Your notes about [person] have shifted in tone recently — something may have changed"
- "[Person A] and [Person B] appear together in your thinking — they might represent similar things to you"
- "You process work stress through [specific behavior] — this seems to be your pattern"
- "There's tension between [theme A] and [theme B] across your notes"

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
- Temporal patterns about WHEN user writes are NOT valuable — skip them entirely
- Focus on WHAT they write about and WHO matters to them`;

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

    // Archive ALL old patterns for this user (not just llm_hybrid)
    // This ensures old temporal/thematic analysis patterns are also cleared
    const { data: archivedPatterns, error: archiveError } = await supabase
      .from('user_patterns')
      .update({ status: 'archived' })
      .eq('user_id', user_id)
      .in('status', ['detected', 'active'])
      .select();

    if (archiveError) {
      console.error('[detect-patterns] Archive error:', archiveError);
    } else {
      console.log('[detect-patterns] Archived old patterns:', archivedPatterns?.length || 0);
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
