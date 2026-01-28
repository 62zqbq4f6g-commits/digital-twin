/**
 * /api/state-of-you - Phase 15: Monthly "State of You" Report
 *
 * Generates comprehensive monthly reports with:
 * - Theme analysis (topics, projects, entities)
 * - People tracking (mentions, sentiment changes)
 * - Sentiment trajectory by category
 * - Pattern highlights from the month
 * - LLM-generated reflection question
 *
 * Endpoints:
 * GET  /api/state-of-you?month=YYYY-MM - Retrieve existing report
 * POST /api/state-of-you/generate - Generate report for specified month
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const { detectContradictions, formatForContext } = require('../lib/contradiction-detection');
const { setCorsHeaders, handlePreflight } = require('./lib/cors.js');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Minimum requirements for report generation
const MIN_NOTES_FOR_REPORT = 5;

module.exports = async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  // Verify auth token and extract user_id
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user_id = user.id;

  try {
    if (req.method === 'GET') {
      return await handleGetReport(req, res, user_id);
    } else if (req.method === 'POST') {
      return await handleGenerateReport(req, res, user_id);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[state-of-you] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET - Retrieve existing report for a month
 */
async function handleGetReport(req, res, user_id) {
  const { month } = req.query;

  if (!month) {
    // Return most recent report
    const { data: report, error } = await supabase
      .from('user_reports')
      .select('*')
      .eq('user_id', user_id)
      .order('report_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[state-of-you] Error fetching report:', error);
      return res.status(500).json({ error: 'Failed to fetch report' });
    }

    if (!report) {
      return res.status(200).json({ report: null, generated: false });
    }

    // Update viewed_at
    await supabase
      .from('user_reports')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', report.id);

    return res.status(200).json({
      report: report.report_data,
      generated: true,
      generated_at: report.generated_at,
      viewed_at: report.viewed_at
    });
  }

  // Fetch specific month
  const reportMonth = `${month}-01`; // First day of month

  const { data: report, error } = await supabase
    .from('user_reports')
    .select('*')
    .eq('user_id', user_id)
    .eq('report_month', reportMonth)
    .maybeSingle();

  if (error) {
    console.error('[state-of-you] Error fetching report:', error);
    return res.status(500).json({ error: 'Failed to fetch report' });
  }

  if (!report) {
    return res.status(200).json({ report: null, generated: false });
  }

  // Update viewed_at
  await supabase
    .from('user_reports')
    .update({ viewed_at: new Date().toISOString() })
    .eq('id', report.id);

  return res.status(200).json({
    report: report.report_data,
    generated: true,
    generated_at: report.generated_at,
    viewed_at: report.viewed_at
  });
}

/**
 * POST - Generate report for specified month
 */
async function handleGenerateReport(req, res, user_id) {
  const { month } = req.body;

  // Default to previous month if not specified
  const targetMonth = month || getPreviousMonth();
  const reportMonth = `${targetMonth}-01`;

  console.log(`[state-of-you] Generating report for ${targetMonth}, user: ${user_id}`);

  // Check if report already exists
  const { data: existingReport } = await supabase
    .from('user_reports')
    .select('id, report_data')
    .eq('user_id', user_id)
    .eq('report_month', reportMonth)
    .maybeSingle();

  if (existingReport) {
    console.log('[state-of-you] Report already exists, returning cached version');
    return res.status(200).json({
      report: existingReport.report_data,
      generated: true,
      cached: true
    });
  }

  // ===== STEP 5a: DATA AGGREGATION =====
  const aggregatedData = await aggregateReportData(user_id, targetMonth);

  if (!aggregatedData.hasEnoughData) {
    return res.status(200).json({
      report: null,
      generated: false,
      message: `Need at least ${MIN_NOTES_FOR_REPORT} notes for a monthly report`
    });
  }

  // ===== STEP 5b: SENTIMENT CALCULATION =====
  const sentimentTrajectory = await calculateSentimentTrajectory(user_id, targetMonth);

  // ===== STEP 5c: PATTERN DETECTION FOR REPORTS =====
  const monthPatterns = await detectMonthPatterns(user_id, targetMonth, aggregatedData);

  // ===== STEP 5c.5: CONTRADICTION/EVOLUTION DETECTION =====
  let evolutions = { contradictions: [], sentimentShifts: [], evolutions: [] };
  try {
    evolutions = await detectContradictions(user_id, { scope: 'monthly' });
  } catch (err) {
    console.warn('[state-of-you] Contradiction detection failed:', err.message);
  }

  // ===== STEP 5d: LLM REFLECTION QUESTION =====
  const reflectionQuestion = await generateReflectionQuestion(
    aggregatedData,
    sentimentTrajectory,
    monthPatterns,
    evolutions
  );

  // ===== STEP 5e: BUILD AND STORE REPORT =====
  // Format evolutions for display
  const evolutionSummaries = [
    ...evolutions.contradictions.map(c => c.summary),
    ...evolutions.sentimentShifts.map(s => s.summary),
    ...evolutions.evolutions.map(e => e.summary)
  ].slice(0, 5); // Limit to 5 most relevant

  const report = {
    month: targetMonth,
    themes: aggregatedData.themes,
    people: aggregatedData.people,
    sentiment_trajectory: sentimentTrajectory,
    patterns_detected: monthPatterns,
    evolutions_detected: evolutionSummaries,
    reflection_question: reflectionQuestion,
    stats: aggregatedData.stats
  };

  // Store report
  const { error: insertError } = await supabase
    .from('user_reports')
    .insert({
      user_id,
      report_month: reportMonth,
      report_data: report
    });

  if (insertError) {
    console.error('[state-of-you] Error storing report:', insertError);
    // Still return the report even if storage fails
  }

  console.log(`[state-of-you] Report generated for ${targetMonth}`);

  return res.status(200).json({
    report,
    generated: true
  });
}

/**
 * STEP 5a: Aggregate report data
 * - Query notes from the month
 * - Aggregate entity mentions
 * - Calculate theme frequencies
 * - Count notes and whispers
 */
async function aggregateReportData(user_id, month) {
  const startDate = `${month}-01`;
  const endDate = getMonthEnd(month);

  console.log(`[state-of-you] Aggregating data for ${startDate} to ${endDate}`);

  // Get notes from the month (metadata only - content is E2E encrypted)
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, created_at')
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (notesError) {
    console.error('[state-of-you] Error fetching notes:', notesError);
  }

  const noteCount = notes?.length || 0;

  if (noteCount < MIN_NOTES_FOR_REPORT) {
    return { hasEnoughData: false, stats: { notes_count: noteCount } };
  }

  // Get whispers from the month
  const { data: whispers, error: whispersError } = await supabase
    .from('whispers')
    .select('id')
    .eq('user_id', user_id)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (whispersError) {
    console.warn('[state-of-you] Error fetching whispers:', whispersError);
  }

  const whisperCount = whispers?.length || 0;

  // Get entities with activity in this month
  // We use updated_at to find entities mentioned during this period
  const { data: entities, error: entitiesError } = await supabase
    .from('user_entities')
    .select('id, name, entity_type, mention_count, sentiment, importance_score, updated_at, context_notes')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .order('mention_count', { ascending: false })
    .limit(50);

  if (entitiesError) {
    console.warn('[state-of-you] Error fetching entities:', entitiesError);
  }

  // Get previous month's data for comparison
  const prevMonth = getPreviousMonthOf(month);
  const prevStartDate = `${prevMonth}-01`;
  const prevEndDate = getMonthEnd(prevMonth);

  const { data: prevMonthEntities } = await supabase
    .from('user_entities')
    .select('name, mention_count')
    .eq('user_id', user_id)
    .eq('status', 'active');

  // Build entity mention map for comparison (simplified - would need historical tracking for accurate comparison)
  const prevMentionMap = new Map();
  for (const e of prevMonthEntities || []) {
    prevMentionMap.set(e.name, e.mention_count);
  }

  // Categorize entities
  const people = (entities || [])
    .filter(e => e.entity_type === 'person')
    .slice(0, 10)
    .map(e => ({
      name: e.name,
      mentions: e.mention_count || 0,
      change: 0, // Would need historical tracking for accurate change
      sentiment: e.sentiment ? parseSentimentScore(e.sentiment) : 0.5
    }));

  const themes = (entities || [])
    .filter(e => e.entity_type !== 'person')
    .slice(0, 10)
    .map(e => ({
      name: e.name,
      mentions: e.mention_count || 0,
      trend: determineTrend(e.mention_count, prevMentionMap.get(e.name) || 0)
    }));

  // Calculate streak (simplified - days with at least one note)
  const notesByDate = new Map();
  for (const note of notes || []) {
    const date = note.created_at.split('T')[0];
    notesByDate.set(date, (notesByDate.get(date) || 0) + 1);
  }

  // Count new entities this month (entities with updated_at in this month and low mention count)
  const entitiesLearned = (entities || []).filter(e => {
    const updatedAt = new Date(e.updated_at);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return updatedAt >= start && updatedAt <= end && (e.mention_count || 0) <= 3;
  }).length;

  // Calculate streak days (consecutive days with notes)
  const streakDays = calculateStreakDays(notes || []);

  return {
    hasEnoughData: true,
    themes,
    people,
    stats: {
      notes_count: noteCount,
      whispers_count: whisperCount,
      entities_learned: entitiesLearned,
      streak_days: streakDays
    },
    rawEntities: entities || []
  };
}

/**
 * STEP 5b: Calculate sentiment trajectory
 * - Group by category
 * - Compare start vs end of month
 */
async function calculateSentimentTrajectory(user_id, month) {
  const startDate = `${month}-01`;
  const endDate = getMonthEnd(month);
  const midDate = `${month}-15`;

  // Get category summaries
  const { data: categories, error } = await supabase
    .from('category_summaries')
    .select('category, summary, updated_at')
    .eq('user_id', user_id);

  if (error || !categories || categories.length === 0) {
    console.warn('[state-of-you] No category data for sentiment trajectory');
    return {};
  }

  // Get entities with sentiment by category approximation
  const { data: entities } = await supabase
    .from('user_entities')
    .select('name, entity_type, sentiment, context_notes, updated_at')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .gte('updated_at', startDate)
    .lte('updated_at', endDate);

  // Group entities by rough category
  const categoryGroups = {
    work: [],
    health: [],
    relationships: [],
    personal: []
  };

  for (const entity of entities || []) {
    const category = inferCategory(entity);
    if (categoryGroups[category]) {
      categoryGroups[category].push(entity);
    }
  }

  // Calculate sentiment for each category
  const trajectory = {};

  for (const [category, entityList] of Object.entries(categoryGroups)) {
    if (entityList.length === 0) continue;

    // Split entities by first half vs second half of month
    const firstHalf = entityList.filter(e => new Date(e.updated_at) < new Date(midDate));
    const secondHalf = entityList.filter(e => new Date(e.updated_at) >= new Date(midDate));

    const startSentiment = calculateAverageSentiment(firstHalf);
    const endSentiment = calculateAverageSentiment(secondHalf);

    if (startSentiment !== null || endSentiment !== null) {
      trajectory[category] = {
        start: startSentiment !== null ? Math.round(startSentiment * 100) / 100 : null,
        end: endSentiment !== null ? Math.round(endSentiment * 100) / 100 : null,
        trend: determineSentimentTrend(startSentiment, endSentiment)
      };
    }
  }

  return trajectory;
}

/**
 * STEP 5c: Pattern detection for reports
 * - Focus on patterns from this specific month
 * - Filter for meaningful patterns only
 */
async function detectMonthPatterns(user_id, month, aggregatedData) {
  // Get confirmed patterns
  const { data: confirmedPatterns } = await supabase
    .from('user_patterns')
    .select('short_description, pattern_type, confidence')
    .eq('user_id', user_id)
    .in('status', ['confirmed', 'detected'])
    .gte('confidence', 0.7)
    .order('confidence', { ascending: false })
    .limit(5);

  if (!confirmedPatterns || confirmedPatterns.length === 0) {
    // Generate ad-hoc patterns from aggregated data
    return generateAdHocPatterns(aggregatedData);
  }

  return confirmedPatterns.map(p => p.short_description);
}

/**
 * STEP 5d: LLM reflection question generation
 */
async function generateReflectionQuestion(aggregatedData, sentimentTrajectory, patterns, evolutions = {}) {
  // Build context for LLM
  const topThemes = aggregatedData.themes.slice(0, 5).map(t => t.name).join(', ');
  const topPeople = aggregatedData.people.slice(0, 3).map(p => p.name).join(', ');
  const sentimentSummary = Object.entries(sentimentTrajectory)
    .map(([cat, data]) => `${cat}: ${data.trend}`)
    .join(', ');
  const patternList = patterns.slice(0, 3).join('; ');

  // Format evolutions for context
  const evolutionContext = formatForContext(evolutions);
  const evolutionSummary = evolutionContext
    ? `\n- Evolutions detected: ${[
        ...evolutions.contradictions.map(c => c.summary),
        ...evolutions.sentimentShifts.map(s => s.summary)
      ].slice(0, 3).join('; ')}`
    : '';

  const prompt = `Based on someone's monthly journal reflection data, generate ONE thought-provoking question.

DATA:
- Top themes this month: ${topThemes || 'varied topics'}
- Key people mentioned: ${topPeople || 'various people'}
- Sentiment changes: ${sentimentSummary || 'stable'}
- Patterns observed: ${patternList || 'none yet'}
- Total notes: ${aggregatedData.stats.notes_count}${evolutionSummary}

REQUIREMENTS:
- Ask something that connects dots or reveals blind spots
- Be specific to their data, not generic
- Keep it warm and curious, not clinical
- One sentence maximum
- No quotes around the question

EXAMPLES OF GOOD QUESTIONS:
- "What would change if you stopped waiting for permission to start that project?"
- "You mentioned 'should' 23 times this month — whose expectations are you carrying?"
- "Marcus appears mostly when you're uncertain — what role does he play in your decision-making?"

Return ONLY the question, nothing else.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    });

    const question = response.content[0].text.trim();
    console.log('[state-of-you] Generated reflection question:', question);
    return question;
  } catch (error) {
    console.error('[state-of-you] LLM error generating question:', error.message);
    // Fallback question
    return "What pattern in your notes surprised you most this month?";
  }
}

// ===== HELPER FUNCTIONS =====

function getPreviousMonth() {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prevMonth.toISOString().slice(0, 7);
}

function getPreviousMonthOf(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const prevMonth = new Date(year, monthNum - 2, 1);
  return prevMonth.toISOString().slice(0, 7);
}

function getMonthEnd(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0);
  return lastDay.toISOString().split('T')[0] + 'T23:59:59.999Z';
}

function determineTrend(current, previous) {
  if (previous === 0) return 'new';
  const change = current - previous;
  if (change > 2) return 'up';
  if (change < -2) return 'down';
  return 'stable';
}

function determineSentimentTrend(start, end) {
  if (start === null || end === null) return 'unknown';
  const diff = end - start;
  if (diff > 0.1) return 'improving';
  if (diff < -0.1) return 'declining';
  return 'stable';
}

function parseSentimentScore(sentiment) {
  if (typeof sentiment === 'number') return sentiment;
  if (sentiment === 'positive') return 0.7;
  if (sentiment === 'negative') return 0.3;
  if (sentiment === 'mixed') return 0.5;
  return 0.5;
}

function calculateAverageSentiment(entities) {
  const sentiments = entities
    .map(e => parseSentimentScore(e.sentiment))
    .filter(s => s !== null && s !== undefined);

  if (sentiments.length === 0) return null;
  return sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
}

function inferCategory(entity) {
  const name = (entity.name || '').toLowerCase();
  const context = (entity.context_notes || []).join(' ').toLowerCase();
  const combined = name + ' ' + context;

  if (combined.includes('work') || combined.includes('project') || combined.includes('meeting') || combined.includes('deadline')) {
    return 'work';
  }
  if (combined.includes('health') || combined.includes('exercise') || combined.includes('sleep') || combined.includes('doctor')) {
    return 'health';
  }
  if (entity.entity_type === 'person') {
    return 'relationships';
  }
  return 'personal';
}

function calculateStreakDays(notes) {
  if (notes.length === 0) return 0;

  const dates = [...new Set(notes.map(n => n.created_at.split('T')[0]))].sort();
  if (dates.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

function generateAdHocPatterns(aggregatedData) {
  const patterns = [];

  // Check for people with high sentiment variance
  const people = aggregatedData.people || [];
  for (const person of people.slice(0, 3)) {
    if (person.sentiment < 0.4) {
      patterns.push(`Your notes about ${person.name} carry some weight this month`);
    } else if (person.sentiment > 0.7) {
      patterns.push(`${person.name} is a source of positive energy in your writing`);
    }
  }

  // Check for dominant themes
  const themes = aggregatedData.themes || [];
  if (themes.length > 0 && themes[0].mentions > 5) {
    patterns.push(`${themes[0].name} has been central to your thinking`);
  }

  return patterns.slice(0, 3);
}
