// Server-only Stripe access via its REST API (fetch + secret key). No SDK
// (consistent with the rest of the app; avoids Metro bundling issues). We use
// Stripe-hosted Checkout (redirect) and verify the result on the success
// redirect + lazily re-check the subscription at period boundaries, so there is
// no inbound webhook to receive (which the Expo/Vercel adapter can't read).

const SECRET = process.env.STRIPE_SECRET_KEY ?? '';
const PRICE_MONTH = process.env.STRIPE_PRICE_MONTHLY ?? '';
const PRICE_YEAR = process.env.STRIPE_PRICE_YEARLY ?? '';

export const stripeConfigured = Boolean(SECRET && PRICE_MONTH && PRICE_YEAR);

export function priceForInterval(interval: 'month' | 'year'): string {
  return interval === 'year' ? PRICE_YEAR : PRICE_MONTH;
}

function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function stripe(path: string, method: 'GET' | 'POST', body?: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${SECRET}`,
      ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body ? formEncode(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

export async function createCheckoutSession(opts: {
  priceId: string;
  userId: string;
  email: string;
  origin: string;
}): Promise<{ url: string }> {
  const data = await stripe('checkout/sessions', 'POST', {
    mode: 'subscription',
    'line_items[0][price]': opts.priceId,
    'line_items[0][quantity]': '1',
    success_url: `${opts.origin}/account?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/account?canceled=1`,
    customer_email: opts.email,
    client_reference_id: opts.userId,
    'subscription_data[metadata][user_id]': opts.userId,
    allow_promotion_codes: 'true',
  });
  return { url: data.url };
}

export function retrieveSession(sessionId: string): Promise<any> {
  return stripe(`checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, 'GET');
}

export function retrieveSubscription(subscriptionId: string): Promise<any> {
  return stripe(`subscriptions/${encodeURIComponent(subscriptionId)}`, 'GET');
}
