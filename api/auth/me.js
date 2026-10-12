import { verify, cookies, noStore } from './_shared.js';
export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).end();
  const session = await verify(cookies(req).wf_session);
  if (!session) return res.status(200).json({ authenticated: false });
  const ownerId = process.env.GITHUB_OWNER_ID;
  return res.status(200).json({ authenticated: true, authorized: Boolean(ownerId && String(session.id) === ownerId), login: session.login });
}
