import { verify, cookies, noStore, origin } from './auth/_shared.js';
const VAL_URL = 'https://amullinfit--e9d9dd94c5d911f1a2631607ee4eb77e.web.val.run';
export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.origin !== origin) return res.status(403).json({ error: 'Invalid request origin' });
  const session = await verify(cookies(req).wf_session);
  if (!session || !process.env.GITHUB_OWNER_ID || String(session.id) !== process.env.GITHUB_OWNER_ID) return res.status(403).json({ error: 'Owner GitHub sign-in required' });
  const secret = process.env.SCHEDULE_WRITE_TOKEN;
  if (!secret || secret.length < 24) return res.status(503).json({ error: 'Server-side scheduling credential is not configured' });
  const body = req.body;
  if (!body || !['schedule', 'remove_scheduled'].includes(body.action) || body.confirm !== true) return res.status(400).json({ error: 'Unsupported write request' });
  const payload = body.action === 'schedule'
    ? { action: 'schedule', plan_id: body.plan_id, start_date: body.start_date, confirm: true, write_token: secret }
    : { action: 'remove_scheduled', instance_id: body.instance_id, confirm: true, write_token: secret };
  try {
    const upstream = await fetch(VAL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(55000) });
    const result = await upstream.json();
    return res.status(upstream.status).json(result);
  } catch { return res.status(502).json({ error: 'Scheduling service unavailable. Check Intervals.icu before retrying.' }); }
}
