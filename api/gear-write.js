import { verify, cookies, noStore, origin } from './auth/_shared.js';

const UPSTREAM = {
  add: 'https://amullinfit--77b77396a8b711f19a3f1607ee4eb77e.web.val.run',
  remove: 'https://amullinfit--7f186c3aa8b711f1b0a01607ee4eb77e.web.val.run',
  manage: 'https://amullinfit--de20b782a4cf11f1832e1607ee4eb77e.web.val.run'
};

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.origin !== origin) return res.status(403).json({ error: 'Invalid request origin' });
  const session = await verify(cookies(req).wf_session);
  if (!session || !process.env.GITHUB_OWNER_ID || String(session.id) !== process.env.GITHUB_OWNER_ID)
    return res.status(403).json({ error: 'Owner GitHub sign-in required' });
  const token = process.env.GEAR_WRITE_TOKEN;
  if (!token || token.length < 32) return res.status(503).json({ error: 'Gear write credential is not configured' });
  const { action, activityId, gearId, gearData, imageUrl } = req.body || {};
  if (!['add', 'remove', 'manage'].includes(action)) return res.status(400).json({ error: 'Invalid gear action' });
  if (action !== 'manage' && (!/^[0-9]+$/.test(String(activityId ?? '')) || (action === 'add' && !/^[0-9]+$/.test(String(gearId ?? '')))))
    return res.status(400).json({ error: 'Invalid activity or gear ID' });
  if (action === 'manage' && !['retire', 'delete', 'create'].includes(req.body?.operation))
    return res.status(400).json({ error: 'Invalid gear management operation' });
  try {
    const url = new URL(UPSTREAM[action]);
    if (action !== 'manage') {
      url.searchParams.set('activityId', String(activityId));
      if (gearId != null) url.searchParams.set('gearId', String(gearId));
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gear-Write-Token': token },
      ...(action === 'manage' ? { body: JSON.stringify({ action: req.body.operation, gearId, gearData, imageUrl }) } : {}),
      signal: AbortSignal.timeout(55000)
    });
    return res.status(response.status).json(await response.json());
  } catch {
    return res.status(502).json({ error: 'Gear service unavailable; check Intervals.icu before retrying' });
  }
}
