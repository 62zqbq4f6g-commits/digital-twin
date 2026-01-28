/**
 * Inscript - Recovery Email API
 * Sends PIN recovery emails via Resend
 */

import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

export default async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { recoveryKey, action } = req.body;

    // Use the authenticated user's email, not a request body email
    const email = user.email;

    if (!email) {
      return res.status(400).json({ error: 'User email not available' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    let subject, html;

    if (action === 'forgot') {
      // Forgot PIN email
      subject = 'Inscript — PIN Recovery';
      html = `
        <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; background: #fff;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="font-size: 24px; font-weight: 500; letter-spacing: 0.1em; margin: 0; color: #000;">
              INSCRIPT
            </h1>
            <p style="font-size: 14px; font-style: italic; margin: 8px 0 0 0; color: #666;">
              Your mirror in code
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 30px;">
            <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 20px 0;">
              You requested to reset your PIN.
            </p>

            <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 20px 0;">
              To reset your PIN, you'll need to clear the app data and set up a new PIN.
              Your cloud-synced notes will be restored once you log in again.
            </p>

            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 14px; color: #666; margin: 0;">
                <strong>To reset:</strong><br>
                1. Clear your browser's local storage for Inscript<br>
                2. Reload the app and set a new PIN<br>
                3. Sign in to restore your synced notes
              </p>
            </div>

            <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 14px; color: #666; margin: 30px 0 0 0;">
              If you didn't request this, please ignore this email.
            </p>
          </div>

          <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; text-align: center;">
            <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 11px; color: #999; letter-spacing: 0.05em; margin: 0;">
              DIGITAL TWIN — YOUR SECOND BRAIN
            </p>
          </div>
        </div>
      `;
    } else {
      // New PIN setup - send recovery key
      subject = 'Inscript — Your Recovery Key';
      html = `
        <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; background: #fff;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="font-size: 18px; font-weight: 400; letter-spacing: 0.15em; margin: 0; color: #000;">
              D I G I T A L
            </h1>
            <h1 style="font-size: 18px; font-weight: 400; letter-spacing: 0.15em; margin: 8px 0 0 0; color: #000;">
              T W I N
            </h1>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 30px;">
            <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 20px 0;">
              Your Inscript PIN has been set up. Save this recovery key in a safe place:
            </p>

            <div style="background: #000; padding: 24px; text-align: center; margin: 30px 0; border-radius: 8px;">
              <code style="font-family: 'SF Mono', monospace; font-size: 20px; letter-spacing: 0.1em; color: #fff;">
                ${recoveryKey}
              </code>
            </div>

            <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 14px; color: #666; margin: 0;">
              This key can be used to recover your notes if you forget your PIN.
              Keep it secure and don't share it with anyone.
            </p>
          </div>

          <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; text-align: center;">
            <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 11px; color: #999; letter-spacing: 0.05em; margin: 0;">
              DIGITAL TWIN — YOUR SECOND BRAIN
            </p>
          </div>
        </div>
      `;
    }

    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Inscript <noreply@resend.dev>',
        to: email,
        subject,
        html
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Resend API error:', errorData);
      throw new Error('Failed to send email');
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Recovery email error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
