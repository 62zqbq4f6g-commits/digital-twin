/**
 * /api/detect-patterns - Phase 13A: Temporal Pattern Detection
 * Analyzes note timestamps to detect recurring patterns like "writes about work on Sundays"
 *
 * Called after note save to check for new patterns
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

// Minimum requirements for pattern detection
const MIN_NOTES_FOR_PATTERN = 5;
const MIN_OCCURRENCES = 3;
const MIN_CONFIDENCE = 0.75;

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
    // Fetch recent notes for pattern analysis
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

    // Detect temporal patterns
    const temporalPatterns = detectTemporalPatterns(notes);

    // DIAGNOSTIC: Log all detected patterns with confidence
    console.log('[detect-patterns] DIAGNOSTIC - Patterns detected:', temporalPatterns.length);
    temporalPatterns.forEach((p, i) => {
      console.log(`[detect-patterns] Pattern ${i + 1}:`, {
        shortDescription: p.shortDescription,
        confidence: p.confidence,
        meetsThreshold: p.confidence >= MIN_CONFIDENCE,
        evidence: p.evidence
      });
    });

    // Store new patterns
    const newPatterns = [];
    const diagnostics = {
      patternsDetected: temporalPatterns.length,
      insertAttempts: 0,
      insertSuccesses: 0,
      insertErrors: [],
      existingUpdates: 0,
      skippedBelowThreshold: 0
    };

    for (const pattern of temporalPatterns) {
      // Check if pattern already exists
      const { data: existing, error: existingError } = await supabase
        .from('user_patterns')
        .select('id, confidence')
        .eq('user_id', user_id)
        .eq('pattern_type', pattern.type)
        .eq('short_description', pattern.shortDescription)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is expected for new patterns
        console.log('[detect-patterns] Error checking existing:', existingError);
      }

      if (existing) {
        // Update existing pattern confidence
        console.log('[detect-patterns] Pattern exists, updating:', pattern.shortDescription);
        if (pattern.confidence > existing.confidence) {
          const { error: updateError } = await supabase
            .from('user_patterns')
            .update({
              confidence: pattern.confidence,
              evidence: pattern.evidence,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (updateError) {
            console.log('[detect-patterns] Update error:', updateError);
          } else {
            diagnostics.existingUpdates++;
          }
        }
      } else {
        // Insert new pattern
        console.log('[detect-patterns] Attempting INSERT for:', pattern.shortDescription);
        diagnostics.insertAttempts++;

        const { data: inserted, error: insertError } = await supabase
          .from('user_patterns')
          .insert({
            user_id,
            pattern_type: pattern.type,
            pattern_text: pattern.shortDescription, // Required NOT NULL column
            description: pattern.description,
            short_description: pattern.shortDescription,
            confidence: pattern.confidence,
            evidence: pattern.evidence,
            detection_method: 'temporal_analysis',
            status: 'detected'
          })
          .select()
          .single();

        if (insertError) {
          console.log('[detect-patterns] INSERT ERROR:', insertError);
          diagnostics.insertErrors.push({
            pattern: pattern.shortDescription,
            error: insertError
          });
        } else if (inserted) {
          console.log('[detect-patterns] INSERT SUCCESS:', inserted.id);
          diagnostics.insertSuccesses++;
          newPatterns.push(inserted);
        }
      }
    }

    console.log('[detect-patterns] DIAGNOSTIC SUMMARY:', diagnostics);

    return res.status(200).json({
      detected: newPatterns,
      total_analyzed: notes.length,
      patterns_found: temporalPatterns.length,
      diagnostics // Include diagnostics in response for debugging
    });

  } catch (error) {
    console.error('[detect-patterns] Error:', error);
    return res.status(500).json({ error: 'Pattern detection failed' });
  }
};

/**
 * Detect temporal patterns from note timestamps
 * Looks for day-of-week and time-of-day correlations
 */
function detectTemporalPatterns(notes) {
  const patterns = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Group notes by day of week
  const byDayOfWeek = {};
  const byTimeOfDay = { morning: [], afternoon: [], evening: [], night: [] };

  for (const note of notes) {
    const date = new Date(note.created_at);
    const day = date.getDay();
    const hour = date.getHours();

    // Day of week grouping
    if (!byDayOfWeek[day]) byDayOfWeek[day] = [];
    byDayOfWeek[day].push(note);

    // Time of day grouping
    if (hour >= 5 && hour < 12) {
      byTimeOfDay.morning.push({ ...note, day });
    } else if (hour >= 12 && hour < 17) {
      byTimeOfDay.afternoon.push({ ...note, day });
    } else if (hour >= 17 && hour < 21) {
      byTimeOfDay.evening.push({ ...note, day });
    } else {
      byTimeOfDay.night.push({ ...note, day });
    }
  }

  // Detect day-of-week patterns (e.g., "writes on Sunday evenings")
  for (const [dayNum, dayNotes] of Object.entries(byDayOfWeek)) {
    const dayName = dayNames[parseInt(dayNum)];
    const totalWeeks = Math.ceil(notes.length / 7);

    if (dayNotes.length >= MIN_OCCURRENCES) {
      const frequency = dayNotes.length / totalWeeks;

      if (frequency >= 0.6) { // At least 60% of that day
        // Check if there's a time pattern on this day
        const eveningNotes = dayNotes.filter(n => {
          const hour = new Date(n.created_at).getHours();
          return hour >= 17 && hour < 22;
        });

        if (eveningNotes.length >= MIN_OCCURRENCES && eveningNotes.length / dayNotes.length >= 0.6) {
          // Pattern: writes on [Day] evenings
          const confidence = Math.min(0.95, eveningNotes.length / dayNotes.length);

          if (confidence >= MIN_CONFIDENCE) {
            patterns.push({
              type: 'temporal',
              shortDescription: `${dayName} evening notes`,
              description: `You tend to write notes on ${dayName} evenings. This might be a time for reflection.`,
              confidence,
              evidence: {
                occurrences: eveningNotes.length,
                total_day_notes: dayNotes.length,
                sample_dates: eveningNotes.slice(0, 3).map(n => n.created_at)
              }
            });
          }
        } else if (dayNotes.length >= MIN_OCCURRENCES) {
          // Pattern: writes frequently on [Day]
          const confidence = Math.min(0.95, frequency);

          if (confidence >= MIN_CONFIDENCE) {
            patterns.push({
              type: 'temporal',
              shortDescription: `${dayName} notes`,
              description: `You often write notes on ${dayName}s. There might be something about this day.`,
              confidence,
              evidence: {
                occurrences: dayNotes.length,
                total_weeks: totalWeeks,
                frequency: frequency.toFixed(2),
                sample_dates: dayNotes.slice(0, 3).map(n => n.created_at)
              }
            });
          }
        }
      }
    }
  }

  // Detect time-of-day patterns across all days
  for (const [timeSlot, timeNotes] of Object.entries(byTimeOfDay)) {
    const ratio = timeNotes.length / notes.length;

    if (ratio >= 0.5 && timeNotes.length >= MIN_OCCURRENCES) {
      const confidence = Math.min(0.95, ratio);

      if (confidence >= MIN_CONFIDENCE) {
        const timeDescriptions = {
          morning: 'in the morning',
          afternoon: 'in the afternoon',
          evening: 'in the evening',
          night: 'late at night'
        };

        patterns.push({
          type: 'temporal',
          shortDescription: `${timeSlot.charAt(0).toUpperCase() + timeSlot.slice(1)} writer`,
          description: `Most of your notes are written ${timeDescriptions[timeSlot]}. This seems to be when you reflect.`,
          confidence,
          evidence: {
            occurrences: timeNotes.length,
            total_notes: notes.length,
            ratio: ratio.toFixed(2),
            sample_dates: timeNotes.slice(0, 3).map(n => n.created_at)
          }
        });
      }
    }
  }

  return patterns;
}
