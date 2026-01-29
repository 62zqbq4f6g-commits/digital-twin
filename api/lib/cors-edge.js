/**
 * Edge Runtime CORS Configuration
 *
 * Restricts API access to allowed origins only.
 * This is the Edge Runtime compatible version of cors.js
 */

const ALLOWED_ORIGINS = [
  'https://digital-twin-ecru.vercel.app',
  'https://inscript.app',  // Future custom domain
];

// Allow localhost in development
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push(
    'http://localhost:8000',
    'http://localhost:3000',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:3000'
  );
}

/**
 * Get CORS headers for Edge Runtime
 * @param {Request} req - Fetch API Request object
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders(req) {
  const origin = req.headers.get('origin');

  // Check if origin is allowed
  const isAllowed = !origin || ALLOWED_ORIGINS.some(allowed =>
    origin === allowed || origin.startsWith(allowed)
  );

  const corsOrigin = (isAllowed && origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle preflight OPTIONS request for Edge Runtime
 * @param {Request} req - Fetch API Request object
 * @returns {Response|null} Response for OPTIONS, null otherwise
 */
export function handlePreflightEdge(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(req)
    });
  }
  return null;
}

export { ALLOWED_ORIGINS };
