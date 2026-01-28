const { setCorsHeaders, handlePreflight } = require('./lib/cors.js');

module.exports = async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return public Supabase config from environment variables
  // Note: SUPABASE_ANON_KEY is public by design - safe to expose to frontend
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  return res.status(200).json({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey
  });
};
