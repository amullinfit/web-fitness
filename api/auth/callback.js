import { origin, callback, verify, sign, cookies, cookie, noStore } from './_shared.js';
export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).end();
  const stored = await verify(cookies(req).wf_oauth_state);
  res.setHeader('Set-Cookie', cookie('wf_oauth_state', '', 0));
  if (!stored || typeof req.query.state !== 'string' || req.query.state !== stored.state || typeof req.query.code !== 'string') return res.status(400).json({ error: 'Invalid or expired OAuth state.' });
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: req.query.code, redirect_uri: callback })
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) return res.status(401).json({ error: 'GitHub authorization failed.' });
  const userResponse = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token.access_token, Accept: 'application/vnd.github+json', 'User-Agent': 'web-fitness' } });
  const user = await userResponse.json();
  if (!userResponse.ok || !Number.isSafeInteger(user.id)) return res.status(401).json({ error: 'Unable to verify GitHub identity.' });
  // No GitHub access token is stored in the browser session.
  const session = await sign({ id: user.id, login: user.login, exp: Date.now() + 8 * 3600000 });
  res.setHeader('Set-Cookie', cookie('wf_session', session, 8 * 3600));
  return res.redirect(302, origin + '/');
}
