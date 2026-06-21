import { adminConfigured, getUserFromToken, setPro } from '../src/lib/supabaseAdmin';
import { stripeConfigured, retrieveSession } from '../src/lib/stripe';

// GET /subscription-sync?session_id=cs_... — called on the post-checkout
// redirect. Verifies the Checkout Session is paid and belongs to the signed-in
// user, then marks them Pro. (Replaces an inbound webhook for the unlock path.)
const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  if (!stripeConfigured || !adminConfigured()) {
    return Response.json({ error: 'Billing is not set up yet.' }, { status: 503, headers: NO_STORE });
  }
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const user = token ? await getUserFromToken(token) : null;
  if (!user) {
    return Response.json({ error: 'Sign in required.' }, { status: 401, headers: NO_STORE });
  }
  const sessionId = new URL(request.url).searchParams.get('session_id') || '';
  if (!sessionId) {
    return Response.json({ error: 'Missing session.' }, { status: 400, headers: NO_STORE });
  }

  try {
    const session = await retrieveSession(sessionId);
    if (session.client_reference_id !== user.id) {
      return Response.json({ error: 'Session does not match this account.' }, { status: 403, headers: NO_STORE });
    }
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (!paid) {
      return Response.json({ pro: false, pending: true }, { headers: NO_STORE });
    }
    const sub = session.subscription; // expanded object (or id string)
    const subObj = typeof sub === 'string' ? null : sub;
    await setPro(user.id, {
      stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripe_subscription_id: typeof sub === 'string' ? sub : sub?.id,
      status: subObj?.status || 'active',
      price_interval: subObj?.items?.data?.[0]?.price?.recurring?.interval || 'month',
      current_period_end: subObj?.current_period_end
        ? new Date(subObj.current_period_end * 1000).toISOString()
        : null,
    });
    return Response.json({ pro: true }, { headers: NO_STORE });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Could not verify the subscription.' }, { status: 502, headers: NO_STORE });
  }
}
