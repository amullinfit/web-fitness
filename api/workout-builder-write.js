import { verify, cookies, noStore, origin } from './auth/_shared.js';

const UPSTREAM = 'https://amullinfit--c1c217a8b22511f19b531607ee4eb77e.web.val.run';
const METHODS = { create_folder: 'POST', create_workout: 'POST', update_workout: 'PUT' };

export default async function handler(req, res) {
  noStore(res);
  if (!['POST', 'PUT'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.origin !== origin) return res.status(403).json({ error: 'Invalid request origin' });
  const session = await verify(cookies(req).wf_session);
  if (!session || !process.env.GITHUB_OWNER_ID || String(session.id) !== process.env.GITHUB_OWNER_ID) return res.status(403).json({ error: 'Owner GitHub sign-in required' });
  const token = process.env.WORKOUT_BUILDER_WRITE_TOKEN;
  if (!token || token.length < 32) return res.status(503).json({ error: 'Workout Builder write credential is not configured' });
  const body = req.body || {};
  if (METHODS[body.action] !== req.method) return res.status(400).json({ error: 'Unsupported Workout Builder write request' });
  try {
    const response = await fetch(UPSTREAM, { method: req.method, headers: { 'Content-Type': 'application/json', 'X-Workout-Builder-Write-Token': token }, body: JSON.stringify(body), signal: AbortSignal.timeout(55000) });
    return res.status(response.status).json(await response.json());
  } catch {
    return res.status(502).json({ error: 'Workout Builder service unavailable; check Intervals.icu before retrying' });
  }
}
