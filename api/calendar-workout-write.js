import { verify, cookies, noStore, origin } from './auth/_shared.js';
const UPSTREAM = 'https://amullinfit--02acff08cb4911f1a9df1607ee4eb77e.web.val.run';
export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.origin !== origin) return res.status(403).json({ error: 'Invalid request origin' });
  const session = await verify(cookies(req).wf_session);
  if (!session || !process.env.GITHUB_OWNER_ID || String(session.id) !== process.env.GITHUB_OWNER_ID) return res.status(403).json({ error: 'Owner GitHub sign-in required' });
  const token = process.env.CALENDAR_WRITE_TOKEN;
  if (!token || token.length < 32) return res.status(503).json({ error: 'Calendar write credential is not configured' });
  const body = req.body || {};
  if (!['add_workout', 'move_workout'].includes(body.action) || body.confirm !== true || !/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') || !/^[0-9]+$/.test(String(body.action === 'move_workout' ? body.event_id : body.workout_id || ''))) return res.status(400).json({ error: 'Invalid calendar write request' });
  try {
    const upstream = await fetch(UPSTREAM, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Calendar-Write-Token': token }, body: JSON.stringify({ action: body.action, confirm: true, date: body.date, workout_id: body.workout_id, event_id: body.event_id, original_date: body.original_date }), signal: AbortSignal.timeout(55000) });
    return res.status(upstream.status).json(await upstream.json());
  } catch { return res.status(502).json({ error: 'Calendar service unavailable; check Intervals.icu before retrying' }); }
}
