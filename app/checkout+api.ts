import { getUserFromToken } from '../src/lib/supabaseAdmin';
import { stripeConfigured, priceForInterval, createCheckoutSession } from '../src/lib/stripe';

// GET /checkout?interval=month|year — creates a Stripe Checkout Session for the
// signed-in user and returns its hosted URL for the client to redirect to.
const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  if (!stripeConfigured) {
    return Response.json({ error: 'Billing is not set up yet.' }, { status: 503, headers: NO_STORE });
  }
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const user = token ? await getUserFromToken(token) : null;
  if (!user) {
    return Response.json({ error: 'Sign in required.', code: 'auth_required' }, { status: 401, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const interval = url.searchParams.get('interval') === 'year' ? 'year' : 'month';
  try {
    const { url: checkoutUrl } = await createCheckoutSession({
      priceId: priceForInterval(interval),
      userId: user.id,
      email: user.email,
      origin: url.origin,
    });
    return Response.json({ url: checkoutUrl }, { headers: NO_STORE });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Could not start checkout.' }, { status: 502, headers: NO_STORE });
  }
}
