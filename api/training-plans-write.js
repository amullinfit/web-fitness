import { verify, cookies, noStore, origin } from './auth/_shared.js';

const UPSTREAM = 'https://amullinfit--e90bd68ec43911f188781607ee4eb77e.web.val.run';
const METHODS = { create_plan: 'POST', copy_plan: 'POST', update_plan: 'PUT' };

export default async function handler(req, res) {
  noStore(res);
  if (!['POST', 'PUT'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.origin !== origin) return res.status(403).json({ error: 'Invalid request origin' });
  const session = await verify(cookies(req).wf_session);
  if (!session || !process.env.GITHUB_OWNER_ID || String(session.id) !== process.env.GITHUB_OWNER_ID) return res.status(403).json({ error: 'Owner GitHub sign-in required' });
  const token = process.env.TRAINING_PLANS_WRITE_TOKEN;
  if (!token || token.length < 32) return res.status(503).json({ error: 'Training plan write credential is not configured' });
  const { action, plan } = req.body || {};
  if (METHODS[action] !== req.method || !plan || typeof plan !== 'object' || Array.isArray(plan)) return res.status(400).json({ error: 'Invalid training plan write request' });
  try {
    const response = await fetch(UPSTREAM, { method: req.method, headers: { 'Content-Type': 'application/json', 'X-Training-Plans-Write-Token': token }, body: JSON.stringify({ action, plan }), signal: AbortSignal.timeout(55000) });
    return res.status(response.status).json(await response.json());
  } catch {
    return res.status(502).json({ error: 'Training plan service unavailable; check Intervals.icu before retrying' });
  }
}
