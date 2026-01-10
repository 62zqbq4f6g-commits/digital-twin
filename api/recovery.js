/**
 * Digital Twin - Recovery Email API
 * Sends PIN recovery emails via Resend
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, recoveryKey, action } = req.body;

    // Verify it's the authorized email
    const AUTHORIZED_EMAIL = 'elroycheo@me.com';
    if (email !== AUTHORIZED_EMAIL) {
      return res.status(403).json({ error: 'Unauthorized email' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    let subject, html;

    if (action === 'forgot') {
      // Forgot PIN email
      subject = 'Digital Twin — PIN Recovery';
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
              You requested to reset your PIN.
            </p>

            <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 20px 0;">
              To reset your PIN, you'll need to clear the app data and set up a new PIN.
              Your cloud-synced notes will be restored once you log in again.
            </p>

            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <p style="font-family: 'Inter', -apple-system, sans-serif; font-size: 14px; color: #666; margin: 0;">
                <strong>To reset:</strong><br>
                1. Clear your browser's local storage for Digital Twin<br>
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
      subject = 'Digital Twin — Your Recovery Key';
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
              Your Digital Twin PIN has been set up. Save this recovery key in a safe place:
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
        from: 'Digital Twin <noreply@resend.dev>',
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
