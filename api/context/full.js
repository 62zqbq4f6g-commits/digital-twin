/**
 * FULL CONTEXT API
 *
 * Phase 2 - Post-RAG Architecture
 *
 * Returns the complete user memory as a structured document.
 * No chunking. No retrieval. Just everything.
 *
 * Endpoint: GET /api/context/full
 * Auth: Bearer token required
 *
 * Query params:
 *   format: 'json' | 'markdown' | 'compact' (default: 'markdown')
 *   focusEntity: string (optional) - Prioritize a specific entity
 *
 * OWNER: T1 (API Layer)
 * CONSUMERS: MIRROR, external integrations, MCP
 */

import { createClient } from '@supabase/supabase-js';
import { loadFullContext, estimateTokenCount } from '../../lib/context/full-loader.js';
import { buildContextDocument, buildCompactDocument } from '../../lib/context/document-builder.js';
import { setCorsHeaders, handlePreflight } from '../lib/cors.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS
  setCorsHeaders(req, res);
  if (handlePreflight(req, res)) return;

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[context/full] Auth error:', authError?.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = user.id;
    const startTime = Date.now();

    // Parse query params
    const format = req.query.format || 'markdown';
    const focusEntity = req.query.focusEntity || null;

    console.log(`[context/full] Loading for user: ${userId}, format: ${format}`);

    // Load full context
    const context = await loadFullContext(userId, {
      includeNoteContent: false, // E2E encrypted - don't include server-side
      noteLimit: 500,
      entityLimit: 200,
      conversationLimit: 50,
    }, supabase);

    // Estimate tokens
    const tokenEstimate = estimateTokenCount(context);

    // Format based on request
    let output;
    let contentType = 'application/json';

    switch (format) {
      case 'markdown':
        output = buildContextDocument(context, {
          maxEntities: 50,
          maxPatterns: 10,
          maxNotes: 20,
          focusEntity
        });
        contentType = 'text/markdown';
        break;

      case 'compact':
        output = buildCompactDocument(context, {
          maxEntities: 20,
          maxPatterns: 5,
          maxBehaviors: 10
        });
        contentType = 'text/markdown';
        break;

      case 'json':
      default:
        output = context;
        break;
    }

    const totalTime = Date.now() - startTime;

    console.log(`[context/full] Loaded in ${totalTime}ms, ~${tokenEstimate} tokens`);

    // Add metadata headers
    res.setHeader('X-Token-Estimate', tokenEstimate.toString());
    res.setHeader('X-Load-Time-Ms', totalTime.toString());
    res.setHeader('X-Entity-Count', context.knowledgeGraph.entityCount.toString());
    res.setHeader('X-Note-Count', context.episodes.noteCount.toString());

    if (format === 'json') {
      return res.status(200).json({
        context: output,
        meta: {
          tokenEstimate,
          loadTimeMs: totalTime,
          format
        }
      });
    } else {
      res.setHeader('Content-Type', contentType);
      return res.status(200).send(output);
    }

  } catch (error) {
    console.error('[context/full] Error:', error);
    return res.status(500).json({ error: 'Failed to load context' });
  }
}
