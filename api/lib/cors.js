/**
 * CORS Configuration
 *
 * Restricts API access to allowed origins only.
 * Security fix: Replaces wildcard (*) CORS with explicit origins.
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
 * Set CORS headers on response
 * @param {Request} req - Incoming request
 * @param {Response} res - Response object
 * @returns {boolean} True if origin is allowed
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '');

  // Check if origin is allowed
  const isAllowed = !origin || ALLOWED_ORIGINS.some(allowed =>
    origin === allowed || origin.startsWith(allowed)
  );

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (isAllowed) {
    // No origin header (same-origin request)
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  return isAllowed;
}

/**
 * Handle preflight OPTIONS request
 * @param {Request} req
 * @param {Response} res
 * @returns {boolean} True if this was an OPTIONS request (handled)
 */
function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = {
  ALLOWED_ORIGINS,
  setCorsHeaders,
  handlePreflight
};
