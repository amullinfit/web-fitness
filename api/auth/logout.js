import { cookie, noStore } from './_shared.js';
export default function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Set-Cookie', cookie('wf_session', '', 0));
  return res.status(204).end();
}
