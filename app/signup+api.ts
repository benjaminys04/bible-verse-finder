import { adminConfigured, adminCreateConfirmedUser } from '../src/lib/supabaseAdmin';
import { rateLimit, clientKey } from '../src/lib/rateLimit';

// GET /signup — credentials passed as URI-encoded request headers
//   x-signup-email, x-signup-password
// Creates an already-confirmed account (service-role Admin API) so the user can
// sign in with their chosen password immediately — no email-confirmation wall.
// The client signs in right after a 200. Returns 503 when accounts aren't
// configured, so the client can fall back to direct (client-side) signup.
//
// Why GET + headers rather than POST + body: this app's server runs on
// @expo/server's Vercel adapter, where reading a request body (request.json())
// never resolves and the function times out (every other route here is likewise
// GET). Headers travel inside the same TLS-encrypted request as a body would,
// but — unlike a query string — are not written to access logs / browser history
// / Referer, so they're a safe carrier for the password. Values are
// URI-encoded so non-ASCII passwords stay header-safe.
const NO_STORE = { 'cache-control': 'no-store' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function decodeHeader(v: string | null): string {
  if (!v) return '';
  try {
    return decodeURIComponent(v);
  } catch {
    return v; // tolerate a value that wasn't encoded
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!adminConfigured()) {
    return Response.json({ error: 'not-configured' }, { status: 503, headers: NO_STORE });
  }

  // The Admin API bypasses GoTrue's built-in signup throttle, so guard the route
  // ourselves against account-creation abuse (per-IP, best-effort).
  const limit = rateLimit(`signup:${clientKey(request)}`);
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many attempts. Please wait a moment and try again.' },
      { status: 429, headers: { ...NO_STORE, 'retry-after': String(limit.retryAfter) } },
    );
  }

  const email = decodeHeader(request.headers.get('x-signup-email')).trim().toLowerCase();
  const password = decodeHeader(request.headers.get('x-signup-password'));

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers: NO_STORE });
  }
  if (password.length < MIN_PASSWORD) {
    return Response.json(
      { error: `Use a password with at least ${MIN_PASSWORD} characters.` },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const result = await adminCreateConfirmedUser(email, password);
    if (result.ok) {
      return Response.json({ ok: true }, { headers: NO_STORE });
    }
    return Response.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || 'Could not create the account. Please try again.' },
      { status: 502, headers: NO_STORE },
    );
  }
}
