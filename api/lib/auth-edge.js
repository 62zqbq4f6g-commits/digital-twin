/**
 * Edge Runtime authentication utilities
 *
 * ES Module version of auth.js for Edge Runtime endpoints.
 */

import { createClient } from '@supabase/supabase-js';

// Create a supabase client with service role for server-side auth verification
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  );
}

/**
 * Edge Runtime compatible auth check
 * Returns Response object on failure, user on success
 *
 * @param {Request} req - Fetch API Request object
 * @param {Object} corsHeaders - CORS headers to include in error response
 * @returns {Promise<{user: User|null, errorResponse: Response|null}>}
 */
export async function requireAuthEdge(req, corsHeaders = {}) {
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

export { getSupabase };
