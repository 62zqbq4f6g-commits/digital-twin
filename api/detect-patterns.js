/**
 * /api/detect-patterns - Phase 15: Deep Behavioral Pattern Detection
 *
 * Finds HIDDEN patterns that create "how did it know that?" moments:
 * - Temporal: "You write longest notes at 11pm — processing time"
 * - Emotional: "Notes after meetings with Sarah are more anxious"
 * - Absence: "You stopped mentioning the Series A 2 weeks ago"
 * - Relational: "You never mention Mom and Dad together"
 * - Change: "Mentions of 'imposter syndrome' dropped from 8x to 1x"
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const { encryptForStorage, isValidKey } = require('./lib/encryption');

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Encryption-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.body;

  // Get encryption key from body or header
  const encryptionKey = req.body.encryptionKey || req.headers['x-encryption-key'];

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  // Validate encryption key if provided
  const hasValidEncryption = encryptionKey && isValidKey(encryptionKey);

  try {
    console.log('[detect-patterns] Starting DEEP behavioral pattern detection for user:', user_id);
    console.log('[detect-patterns] Encryption:', hasValidEncryption ? 'enabled' : 'disabled');

    // ===== STEP 1: GATHER RICH DATA =====

    // Get notes with metadata (can't read encrypted content)
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, created_at')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

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

    // Get ALL entities with temporal data
    const { data: entities, error: entitiesError } = await supabase
      .from('user_entities')
      .select('name, entity_type, mention_count, sentiment_average, context_notes, relationship, importance_score, first_mentioned_at, last_mentioned_at, created_at')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .order('mention_count', { ascending: false })
      .limit(50);

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

    // ===== STEP 2: PREPARE RICH PATTERN DATA =====

    const patternData = preparePatternData(notes, entities || []);

    console.log('[detect-patterns] Data prepared:', {
      noteCount: notes.length,
      entityCount: entities?.length || 0,
      categoryCount: categories?.length || 0,
      absencesDetected: patternData.absences.length,
      peakHour: patternData.peakHour
    });

    // ===== STEP 3: BUILD LLM PROMPT =====

    // Entity summary with timeline context
    const entitySummary = (entities || []).slice(0, 20).map(e => {
      const daysSince = e.last_mentioned_at
        ? Math.floor((Date.now() - new Date(e.last_mentioned_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let contextStr = '';
      if (Array.isArray(e.context_notes) && e.context_notes.length > 0) {
        const contexts = e.context_notes.slice(0, 3).map(c => `"${c}"`).join('; ');
        contextStr = `\n    Context: ${contexts}`;
      }

      const sentiment = e.sentiment_average !== null
        ? (e.sentiment_average > 0.3 ? 'positive' : e.sentiment_average < -0.3 ? 'negative' : 'neutral')
        : 'unknown';

      return `- ${e.name} (${e.entity_type}): ${e.mention_count}x, sentiment: ${sentiment}, last: ${daysSince !== null ? daysSince + ' days ago' : 'unknown'}${e.relationship ? `, relationship: ${e.relationship}` : ''}${contextStr}`;
    }).join('\n') || 'No entities tracked yet.';

    // Category summary
    const categorySummary = (categories || []).map(c =>
      `- ${c.category}: ${c.entity_count || 0} items — ${(c.summary || 'No summary').substring(0, 150)}`
    ).join('\n') || 'No category summaries yet.';

    // Build the deep insight prompt
    const prompt = buildDeepPatternPrompt(patternData, entitySummary, categorySummary, notes.length);

    // ===== STEP 4: ASK LLM FOR DEEP PATTERNS =====

    let patterns = [];
    try {
      console.log('[detect-patterns] Calling LLM for deep behavioral analysis...');

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      console.log('[detect-patterns] LLM response preview:', text.substring(0, 300) + '...');

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          patterns = parsed.patterns || [];
        } catch (parseError) {
          console.error('[detect-patterns] JSON parse error:', parseError.message);
          console.error('[detect-patterns] Raw JSON that failed:', jsonMatch[0].substring(0, 500));
          // Return error so frontend knows detection failed
          return res.status(200).json({
            detected: [],
            message: 'Pattern detection returned invalid JSON - please try again',
            error: 'json_parse_failed',
            debug: text.substring(0, 200)
          });
        }
      } else {
        console.error('[detect-patterns] No JSON found in LLM response');
        console.error('[detect-patterns] Raw response:', text.substring(0, 500));
        return res.status(200).json({
          detected: [],
          message: 'Pattern detection did not return structured data - please try again',
          error: 'no_json_in_response'
        });
      }

      console.log(`[detect-patterns] LLM found ${patterns.length} patterns`);

      // Post-process: Filter out weak patterns
      patterns = patterns.filter(p => {
        const text = (p.insight + ' ' + (p.evidence || '')).toLowerCase();

        // Filter out patterns that are just data summaries
        const weakPatterns = [
          'you mention', 'is mentioned', 'comes up often',
          'you write about', 'you think about',
          'appears frequently', 'shows up in your notes'
        ];

        for (const weak of weakPatterns) {
          if (text.includes(weak) && !text.includes('when') && !text.includes('after') && !text.includes('before')) {
            console.log(`[detect-patterns] Filtered weak pattern: "${p.insight.substring(0, 50)}..."`);
            return false;
          }
        }
        return true;
      });

      console.log(`[detect-patterns] After filtering: ${patterns.length} patterns`);
    } catch (llmError) {
      console.error('[detect-patterns] LLM error:', llmError.message);
      return res.status(200).json({
        detected: [],
        message: 'LLM pattern detection failed, will retry later',
        error: llmError.message
      });
    }

    // ===== STEP 5: STORE PATTERNS =====

    // Reject old detected patterns for this user
    const { error: rejectError } = await supabase
      .from('user_patterns')
      .update({ status: 'rejected' })
      .eq('user_id', user_id)
      .in('status', ['detected', 'pending']);

    if (rejectError) {
      console.error('[detect-patterns] Reject old patterns error:', rejectError);
    }

    const newPatterns = [];
    let firstInsertError = null;
    for (const pattern of patterns) {
      // Include all required columns for user_patterns table
      const fullDescription = `${pattern.insight}\n\nEvidence: ${pattern.evidence || 'Based on note patterns'}\n\nSignificance: ${pattern.significance || 'This reveals something about how you process and think.'}`;
      const insertData = {
        user_id,
        pattern_type: pattern.type || 'behavioral',
        pattern_text: pattern.insight, // Required NOT NULL column
        description: fullDescription,
        short_description: pattern.insight,
        confidence: pattern.confidence || 0.7,
        evidence: {
          evidence_text: pattern.evidence,
          significance: pattern.significance,
          type: pattern.type
        },
        detection_method: 'deep_behavioral',
        status: 'detected'
      };

      // If encryption is enabled, encrypt sensitive fields
      if (hasValidEncryption) {
        const sensitiveData = {
          pattern_type: pattern.type || 'behavioral',
          description: insertData.description,
          short_description: pattern.insight,
          evidence: insertData.evidence
        };
        insertData.encrypted_data = encryptForStorage(sensitiveData, encryptionKey);
      }

      const { data: inserted, error: insertError } = await supabase
        .from('user_patterns')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('[detect-patterns] Insert error:', insertError);
        console.error('[detect-patterns] Insert data was:', JSON.stringify(insertData, null, 2).substring(0, 500));
        // Capture first error for debugging
        if (!firstInsertError) {
          firstInsertError = insertError;
        }
      } else if (inserted) {
        console.log(`[detect-patterns] Inserted: "${inserted.short_description.substring(0, 50)}..."${hasValidEncryption ? ' [encrypted]' : ''}`);
        newPatterns.push(inserted);
      }
    }

    console.log('[detect-patterns] Completed. Inserted:', newPatterns.length);

    // Include any insert errors in response for debugging
    const insertErrors = patterns.length - newPatterns.length;

    return res.status(200).json({
      detected: newPatterns,
      total_analyzed: notes.length,
      patterns_found: patterns.length,
      patterns_inserted: newPatterns.length,
      insert_failures: insertErrors,
      insert_error: firstInsertError ? { message: firstInsertError.message, code: firstInsertError.code, details: firstInsertError.details } : null,
      method: 'deep_behavioral',
      data_summary: {
        absences: patternData.absences.length,
        peakHour: patternData.peakHour,
        entityCount: entities?.length || 0
      }
    });

  } catch (error) {
    console.error('[detect-patterns] Error:', error);
    return res.status(500).json({ error: 'Pattern detection failed' });
  }
};

/**
 * Prepare rich data for pattern detection
 */
function preparePatternData(notes, entities) {
  const now = new Date();

  // Distribution by day of week
  const byDayOfWeek = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  notes.forEach(n => {
    const day = dayNames[new Date(n.created_at).getDay()];
    byDayOfWeek[day]++;
  });

  // Distribution by hour (for peak detection)
  const byHour = {};
  notes.forEach(n => {
    const hour = new Date(n.created_at).getHours();
    byHour[hour] = (byHour[hour] || 0) + 1;
  });

  // Find peak hour
  let peakHour = 12;
  let peakCount = 0;
  for (const [hour, count] of Object.entries(byHour)) {
    if (count > peakCount) {
      peakCount = count;
      peakHour = parseInt(hour);
    }
  }

  // Format peak hour nicely
  const peakHourFormatted = peakHour === 0 ? '12am' :
    peakHour < 12 ? `${peakHour}am` :
    peakHour === 12 ? '12pm' :
    `${peakHour - 12}pm`;

  // Entity timelines with absence detection
  const entityTimelines = entities.map(e => {
    const lastMentioned = e.last_mentioned_at || e.created_at;
    const daysSince = Math.floor((now - new Date(lastMentioned)) / (1000 * 60 * 60 * 24));

    return {
      name: e.name,
      type: e.entity_type,
      mentions: e.mention_count || 1,
      sentiment: e.sentiment_average,
      relationship: e.relationship,
      lastMentioned: lastMentioned,
      daysSinceLastMention: daysSince,
      context: e.context_notes
    };
  });

  // Detect absences (frequently mentioned but gone silent for 14+ days)
  const absences = entityTimelines.filter(e =>
    e.mentions >= 3 && e.daysSinceLastMention >= 14
  ).sort((a, b) => b.mentions - a.mentions);

  // Detect recent surges (entities mentioned 3+ times in last 7 days)
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const recentlySurging = entityTimelines.filter(e => {
    const lastMentionDate = new Date(e.lastMentioned);
    return e.mentions >= 3 && lastMentionDate >= sevenDaysAgo && e.daysSinceLastMention <= 3;
  });

  // Day with most notes
  const peakDay = Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0];

  // Time of day analysis
  const timeOfDay = {
    lateNight: (byHour[23] || 0) + (byHour[0] || 0) + (byHour[1] || 0) + (byHour[2] || 0),
    morning: (byHour[6] || 0) + (byHour[7] || 0) + (byHour[8] || 0) + (byHour[9] || 0) + (byHour[10] || 0) + (byHour[11] || 0),
    afternoon: (byHour[12] || 0) + (byHour[13] || 0) + (byHour[14] || 0) + (byHour[15] || 0) + (byHour[16] || 0) + (byHour[17] || 0),
    evening: (byHour[18] || 0) + (byHour[19] || 0) + (byHour[20] || 0) + (byHour[21] || 0) + (byHour[22] || 0)
  };

  return {
    byDayOfWeek,
    byHour,
    peakHour,
    peakHourFormatted,
    peakDay: peakDay[0],
    peakDayCount: peakDay[1],
    entityTimelines,
    absences,
    recentlySurging,
    timeOfDay,
    totalNotes: notes.length
  };
}

/**
 * Build the deep pattern detection prompt
 */
function buildDeepPatternPrompt(patternData, entitySummary, categorySummary, noteCount) {
  const { byDayOfWeek, peakHourFormatted, peakDay, absences, recentlySurging, timeOfDay } = patternData;

  // Build absence section
  const absenceSection = absences.length > 0
    ? absences.slice(0, 5).map(a =>
        `- ${a.name}: ${a.mentions} mentions total, silent for ${a.daysSinceLastMention} days`
      ).join('\n')
    : 'None detected';

  // Build surge section
  const surgeSection = recentlySurging.length > 0
    ? recentlySurging.slice(0, 3).map(s =>
        `- ${s.name}: ${s.mentions}x mentions, very active recently`
      ).join('\n')
    : 'None detected';

  return `You are a behavioral psychologist finding HIDDEN patterns — unconscious behaviors the person doesn't realize they're doing.

Your goal: Create "how did it know that?!" moments by revealing hidden truths.

## Pattern Quality Standards

NEVER produce these (boring, obvious):
❌ "You write about work" — so what?
❌ "Sarah appears often" — frequency isn't insight
❌ "You write on Sundays" — timing alone is meaningless
❌ "You have work-related notes" — category listing

ALWAYS produce these (profound, surprising):
✅ EMOTIONAL TRIGGER: "When you write about [person], your language becomes [more defensive/hopeful/anxious] — there might be unresolved tension there"
✅ UNSPOKEN PATTERN: "You bring up [topic A] and [topic B] in the same breath, but never acknowledge they're connected"
✅ TELLING ABSENCE: "[Person/topic] went from appearing weekly to complete silence. Something shifted."
✅ HIDDEN CYCLE: "Every time you mention [trigger], within 2-3 notes you're processing [consequence]"
✅ SELF-CONTRADICTION: "You say you're fine with [X], but the way you keep returning to it suggests otherwise"
✅ RELATIONSHIP DYNAMIC: "You process conversations with [person] differently than anyone else — what makes them different?"

## User's Behavioral Data

<temporal_patterns>
Notes by day: ${JSON.stringify(byDayOfWeek)}
Peak writing time: ${peakHourFormatted}
Peak day: ${peakDay}
Time distribution: Late night ${timeOfDay.lateNight}, Morning ${timeOfDay.morning}, Afternoon ${timeOfDay.afternoon}, Evening ${timeOfDay.evening}
Total notes: ${noteCount}
</temporal_patterns>

<entities_with_context>
${entitySummary}
</entities_with_context>

<absences>
These were frequently mentioned but have gone silent:
${absenceSection}
</absences>

<recent_focus>
These are getting a lot of attention right now:
${surgeSection}
</recent_focus>

<life_areas>
${categorySummary}
</life_areas>

## Your Task

Find 3-5 PROFOUND behavioral patterns that reveal hidden truths about this person.

Each pattern MUST:
1. **insight**: A single, punchy observation that makes them go "wait... how did it know?" (max 20 words)
2. **evidence**: The specific data that proves this — cite entity names and numbers
3. **significance**: What this reveals about their inner world, unspoken needs, or blind spots
4. **confidence**: 0.65-0.9 (be conservative — profound insights need solid backing)
5. **type**: emotional / absence / relational / contradiction / cycle

QUALITY RULES (non-negotiable):
- If an insight wouldn't make a therapist nod knowingly, cut it
- Absences and silences often reveal more than what's said — USE THEM
- Connect entities that shouldn't be connected — "you always mention X right after Y"
- Challenge their narrative — "you say you're over X, but..."
- Look for what they're avoiding, not just what they're saying
- If you can't find 3 profound patterns, return FEWER. Never pad with weak observations.

Return ONLY valid JSON:
{
  "patterns": [
    {
      "insight": "You tend to process difficult conversations at night — your ${peakHourFormatted} notes often revisit the day's tensions",
      "evidence": "${timeOfDay.lateNight > timeOfDay.morning ? 'Heavy late-night writing pattern' : 'Based on note timing patterns'}",
      "significance": "This might be your mind's way of making sense of things before sleep",
      "confidence": 0.75,
      "type": "temporal"
    }
  ]
}`;
}
