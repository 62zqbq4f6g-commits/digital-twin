// /api/export.js
// OWNER: T1
// STATUS: Complete
// DEPENDS ON: /lib/export/* (T2)

/**
 * INSCRIPT: Data Export API
 *
 * Phase 18 - PAMP Foundation (Portable AI Memory Protocol)
 * Exports user data in PAMP-compatible JSON format.
 *
 * Endpoint: GET /api/export
 * Auth: Bearer token required
 * Returns: JSON file download
 *
 * Privacy: User can only export their own data.
 * All data is user-owned and portable per PAMP principles.
 */

import { createClient } from '@supabase/supabase-js';

// T2's data layer
import {
  getProfile,
  getKeyPeople,
  getEntities,
  getEntityFacts,
  getNotes,
  getMeetings,
  getConversations,
  getPatterns
} from '../lib/export/queries.js';

import {
  buildIdentity,
  transformEntity,
  transformNote,
  transformMeeting,
  transformConversation,
  transformPattern,
  buildMeta
} from '../lib/export/transforms.js';

import { filterByPrivacy } from '../lib/export/privacy.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check - get user from session/token
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Log request info
  console.log(`[Export] Request from ${req.headers['x-forwarded-for'] || 'unknown'}`);
  console.log(`[Export] User-Agent: ${req.headers['user-agent']}`);

  try {
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Export] Auth error:', authError?.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user_id = user.id;
    console.log(`[Export] Starting for user: ${user_id}`);
    const startTime = Date.now();

    // ============================================
    // GATHER DATA (T2's query layer)
    // ============================================

    // Query timing helper
    const timings = {};
    const timeQuery = async (name, fn) => {
      const start = Date.now();
      const result = await fn();
      timings[name] = Date.now() - start;
      return result;
    };

    // Gather all data in parallel using T2's functions
    const [profile, keyPeople, entities, facts, notes, meetings, conversations, patterns] =
      await Promise.all([
        timeQuery('profile', () => getProfile(user_id)),
        timeQuery('keyPeople', () => getKeyPeople(user_id)),
        timeQuery('entities', () => getEntities(user_id)),
        timeQuery('facts', () => getEntityFacts(user_id)),
        timeQuery('notes', () => getNotes(user_id)),
        timeQuery('meetings', () => getMeetings(user_id)),
        timeQuery('conversations', () => getConversations(user_id)),
        timeQuery('patterns', () => getPatterns(user_id))
      ]);

    console.log(`[Export] Query timings:`, timings);
    console.log(`[Export] Data gathered: ${entities.length} entities, ${facts.length} facts, ${notes.length} notes, ${patterns.length} patterns`);

    // ============================================
    // PRIVACY FILTERING (T2's privacy layer)
    // ============================================

    const publicEntities = filterByPrivacy(entities);
    const publicNotes = filterByPrivacy(notes);
    const publicPatterns = filterByPrivacy(patterns);

    console.log(`[Export] After privacy filter: ${publicEntities.length} entities, ${publicNotes.length} notes, ${publicPatterns.length} patterns`);

    // ============================================
    // HANDLE EDGE CASES
    // ============================================

    // Empty account handling
    if (!publicNotes.length && !publicEntities.length) {
      console.log(`[Export] Empty account for user: ${user_id}`);
      // Still return valid structure, just empty
    }

    // Large export handling (>1000 notes)
    if (publicNotes.length > 1000) {
      console.log(`[Export] Large export: ${publicNotes.length} notes`);
      // For v1, proceed but log warning
    }

    // ============================================
    // BUILD EXPORT STRUCTURE (T2's transform layer)
    // ============================================

    const exportData = {
      inscript_export: {
        identity: buildIdentity(profile, keyPeople),
        entities: publicEntities.map(e => transformEntity(e, facts)),
        episodes: {
          notes: publicNotes.map(transformNote),
          meetings: meetings.map(transformMeeting),
          conversations: conversations.map(transformConversation)
        },
        patterns: publicPatterns.map(transformPattern),
        meta: buildMeta({
          entities: publicEntities,
          notes: publicNotes,
          patterns: publicPatterns,
          facts,
          conversations
        })
      }
    };

    const duration = Date.now() - startTime;
    console.log(`[Export] Completed in ${duration}ms`);

    // Return as downloadable JSON
    const filename = `inscript-export-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).json(exportData);

  } catch (error) {
    console.error('[Export] Failed:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
}
