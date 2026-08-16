// Vercel serverless function that terminates Google's redirect-mode POST.
//
// Google Identity Services, with `ux_mode: 'redirect'` and an explicit
// `login_uri`, POSTs the ID token (a `credential` form field) to that endpoint.
// A static SPA cannot read a POST body — Vercel would serve index.html and the
// credential would be lost (or return 405). This function instead bounces the
// browser back to the SPA with the token in the URL fragment, where the app
// parses `#id_token=...` and exchanges it via POST /api/auth/google on the
// backend, which verifies the JWT server-side.
//
// Register this function's URL in the Google Cloud Console OAuth client's
// "Authorized redirect URIs" (e.g. https://cartify-hub.vercel.app/api/google-auth).

const extractCredential = (body) => {
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return body.credential || '';
  }
  const raw = Buffer.isBuffer(body) ? body.toString() : String(body || '');
  return new URLSearchParams(raw).get('credential') || '';
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  const credential = extractCredential(req.body);

  if (!credential) {
    res.status(400).json({ error: 'Missing Google credential' });
    return;
  }

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${protocol}://${host}`;

  res.status(302);
  res.setHeader('Location', `${origin}/login#id_token=${encodeURIComponent(credential)}`);
  res.end();
}