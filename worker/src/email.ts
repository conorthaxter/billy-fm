import type { Env } from './index';

// ---------------------------------------------------------------------------
// Resend email helper
// ---------------------------------------------------------------------------

export async function sendNotificationEmail(
  env: Env,
  opts: { to: string; subject: string; body: string },
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'billy-fm <notifications@billy-fm.com>',
      to: [opts.to],
      subject: opts.subject,
      text: opts.body,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[email] Resend error:', res.status, text);
  }
}
