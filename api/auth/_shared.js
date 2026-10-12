// GitHub OAuth helpers for Vercel serverless functions. No secrets are exposed to Vite.
export const origin = 'https://web-fitness-indol.vercel.app';
export const callback = origin + '/api/auth/callback';
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const key = async () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
};
export async function sign(payload) {
  const data = b64(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await key(), encoder.encode(data));
  return data + '.' + b64(new Uint8Array(signature));
}
export async function verify(token) {
  if (!token || !token.includes('.')) return null;
  try {
    const [data, signature] = token.split('.');
    if (!await crypto.subtle.verify('HMAC', await key(), unb64(signature), encoder.encode(data))) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64(data)));
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}
export const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split(/=(.*)/s).slice(0, 2).map(decodeURIComponent)).filter(x => x[0]));
export const cookie = (name, value, maxAge) => name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
export const noStore = res => res.setHeader('Cache-Control', 'no-store');
