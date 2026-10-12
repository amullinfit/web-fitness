import { origin, callback, sign, cookie, noStore } from './_shared.js';
export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).end();
  // A single registered GitHub callback is used; preview hosts do not share its cookies.
  if (req.headers.host !== new URL(origin).host) return res.status(403).json({ error: 'GitHub login is currently enabled only on the registered production domain.' });
  if (!process.env.GITHUB_CLIENT_ID || !process.env.SESSION_SECRET) return res.status(503).json({ error: 'OAuth is not configured.' });
  const state = crypto.randomUUID();
  res.setHeader('Set-Cookie', cookie('wf_oauth_state', await sign({ state, exp: Date.now() + 600000 }), 600));
  const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: callback, state });
  res.redirect(302, 'https://github.com/login/oauth/authorize?' + params);
}
