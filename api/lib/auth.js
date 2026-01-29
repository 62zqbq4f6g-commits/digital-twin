/**
 * Shared authentication utilities for API routes
 *
 * Usage:
 *   const { requireAuth } = require('./lib/auth.js');
 *   const { user, error } = await requireAuth(req, supabase);
 *   if (error) return res.status(error.status).json({ error: error.message });
 */

const { createClient } = require('@supabase/supabase-js');

// Create a supabase client with service role for server-side auth verification
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  );
}

/**
 * Verify auth token and return user
 *
 * @param {Request} req - HTTP request object
 * @param {SupabaseClient} supabase - Optional Supabase client (will create one if not provided)
 * @returns {Promise<{user: User|null, error: {status: number, message: string}|null}>}
 */
async function requireAuth(req, supabase = null) {
  const authHeader = req.headers.authorization || req.headers.get?.('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      error: { status: 401, message: 'Authorization required' }
    };
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const client = supabase || getSupabase();
    const { data: { user }, error: authError } = await client.auth.getUser(token);

    if (authError || !user) {
      return {
        user: null,
        error: { status: 401, message: 'Invalid token' }
      };
    }

    return { user, error: null };
  } catch (err) {
    console.error('[auth] Verification failed:', err.message);
    return {
      user: null,
      error: { status: 401, message: 'Authentication failed' }
    };
  }
}

/**
 * Edge Runtime compatible auth check
 * Returns Response object on failure, null on success (sets userId on request)
 *
 * @param {Request} req - Fetch API Request object
 * @param {Object} corsHeaders - CORS headers to include in error response
 * @returns {Promise<{user: User|null, errorResponse: Response|null}>}
 */
async function requireAuthEdge(req, corsHeaders = {}) {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authorization required' } }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    };
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        user: null,
        errorResponse: new Response(
          JSON.stringify({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      };
    }

    return { user, errorResponse: null };
  } catch (err) {
    console.error('[auth-edge] Verification failed:', err.message);
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication failed' } }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    };
  }
}

module.exports = {
  requireAuth,
  requireAuthEdge,
  getSupabase
};
