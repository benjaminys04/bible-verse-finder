// Server-only Supabase access for metering + admin. Uses the SECRET (service
// role) key, which bypasses Row Level Security, so it must NEVER be imported by
// client code — only by API routes (app/*+api.ts). Plain fetch (no SDK).

import { stripeConfigured, retrieveSubscription } from './stripe';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();

export const FREE_MONTHLY_LIMIT = 10;

export function adminConfigured(): boolean {
  return Boolean(URL && ANON && SERVICE);
}

export interface AuthedUser {
  id: string;
  email: string;
}

// Create a new user that is ALREADY email-confirmed, so they can sign in with
// their chosen password immediately — no confirmation email, no "Email not
// confirmed" wall. Uses the service-role Admin API (bypasses the project's
// "Confirm email" setting). Returns a discriminated result the route maps to
// HTTP status codes.
export type CreateUserResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function adminCreateConfirmedUser(email: string, password: string): Promise<CreateUserResult> {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (res.ok && data?.id) return { ok: true };

  // Duplicate email → GoTrue returns 422 (code 'email_exists') or a message
  // mentioning "already registered". Surface as 409 so the client can steer the
  // user to sign in instead.
  const msg: string = data?.msg || data?.error_description || data?.message || '';
  const code: string = data?.error_code || data?.code || '';
  const duplicate =
    res.status === 422 || code === 'email_exists' || /already been registered|already registered|already exists/i.test(msg);
  if (duplicate) {
    return { ok: false, status: 409, error: 'An account with this email already exists. Try signing in instead.' };
  }
  return { ok: false, status: res.status || 502, error: msg || 'Could not create the account. Please try again.' };
}

// Verify a user access token with Supabase and return the user (or null).
export async function getUserFromToken(token: string): Promise<AuthedUser | null> {
  if (!token) return null;
  const res = await fetch(`${URL}/auth/v1/user`, {
    headers: { apikey: ANON, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  if (!u?.id) return null;
  return { id: u.id, email: (u.email ?? '').toLowerCase() };
}

function svcHeaders(extra: Record<string, string> = {}) {
  return { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json', ...extra };
}

interface ProfileRow {
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
}

async function readProfile(userId: string): Promise<ProfileRow | null> {
  const res = await fetch(`${URL}/rest/v1/profiles?select=role,plan&id=eq.${userId}`, { headers: svcHeaders() });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function patchProfile(userId: string, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
}

export interface Entitlement {
  unlimited: boolean;
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
}

// Resolve what a user is allowed to do, auto-granting admin to ADMIN_EMAIL.
export async function getEntitlement(user: AuthedUser): Promise<Entitlement> {
  let profile = await readProfile(user.id);

  // Auto-grant admin (idempotent) for the configured admin email.
  if (ADMIN_EMAIL && user.email === ADMIN_EMAIL && profile?.role !== 'admin') {
    await patchProfile(user.id, { role: 'admin' });
    profile = { role: 'admin', plan: profile?.plan ?? 'free' };
  }

  const role = profile?.role ?? 'user';
  let plan = profile?.plan ?? 'free';

  if (role === 'admin') return { unlimited: true, role, plan };

  // Pro users: lazily confirm the subscription is still active at period
  // boundaries (handles renewals + cancellations without an inbound webhook).
  if (plan === 'pro') {
    plan = (await verifyProStillActive(user.id)) ? 'pro' : 'free';
  }
  return { unlimited: plan === 'pro', role, plan };
}

// ── Subscriptions (Stripe) ──────────────────────────────────────────────────

export interface SubRow {
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status?: string;
  price_interval?: string;
  current_period_end?: string | null;
}

export async function getSubscription(userId: string): Promise<SubRow | null> {
  const res = await fetch(`${URL}/rest/v1/subscriptions?select=*&user_id=eq.${userId}`, { headers: svcHeaders() });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function patchSubscription(userId: string, patch: SubRow): Promise<void> {
  await fetch(`${URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

// Mark a user Pro and record their subscription (called from /subscription-sync).
export async function setPro(userId: string, sub: SubRow): Promise<void> {
  await patchProfile(userId, { plan: 'pro' });
  await fetch(`${URL}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: svcHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ user_id: userId, ...sub, updated_at: new Date().toISOString() }),
  });
}

async function verifyProStillActive(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId);
  if (!sub) return true; // plan=pro with no Stripe record (e.g. set manually) — trust it
  const periodEnd = sub.current_period_end ? Date.parse(sub.current_period_end) : 0;
  // Still inside the paid period (+1 day grace) → active, no Stripe call needed.
  if (periodEnd && periodEnd + 86_400_000 > Date.now()) return true;
  if (!sub.stripe_subscription_id || !stripeConfigured) return false;
  try {
    const fresh = await retrieveSubscription(sub.stripe_subscription_id);
    const active = fresh.status === 'active' || fresh.status === 'trialing';
    if (active) {
      await patchSubscription(userId, {
        status: fresh.status,
        current_period_end: fresh.current_period_end
          ? new Date(fresh.current_period_end * 1000).toISOString()
          : null,
      });
      return true;
    }
    await patchProfile(userId, { plan: 'free' });
    await patchSubscription(userId, { status: fresh.status });
    return false;
  } catch {
    return true; // Stripe unreachable → fail open, don't wrongly block a paying user
  }
}

function period(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM' (UTC)
}

export async function getUsage(userId: string): Promise<number> {
  const res = await fetch(
    `${URL}/rest/v1/usage_monthly?select=message_count&user_id=eq.${userId}&period=eq.${period()}`,
    { headers: svcHeaders() },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0].message_count : 0;
}

// Increment this user's monthly count (upsert on the (user_id, period) primary
// key). Read-modify-write is fine at this scale; the per-IP rate limiter guards
// against bursts.
export async function incrementUsage(userId: string): Promise<void> {
  const current = await getUsage(userId);
  await fetch(`${URL}/rest/v1/usage_monthly`, {
    method: 'POST',
    headers: svcHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ user_id: userId, period: period(), message_count: current + 1 }),
  });
}

// Mark a user as recently active (powers "logged-in / active users").
export async function touchLastSeen(userId: string): Promise<void> {
  await patchProfile(userId, { last_seen_at: new Date().toISOString() }).catch(() => {});
}

// Record a page view (no-op if the optional page_views table hasn't been created).
export async function recordPageView(path: string): Promise<void> {
  await fetch(`${URL}/rest/v1/page_views`, {
    method: 'POST',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ path: path.slice(0, 256) }),
  }).catch(() => {});
}

export interface AdminStats {
  totalAccounts: number;
  proSubscribers: number;
  admins: number;
  activeThisMonth: number;
  loggedInEver: number;
  messagesThisMonth: number;
  messagesAllTime: number;
  pageViews: number | null; // null = page_views table not set up yet
  topUsers: { email: string; messages: number }[];
  monthlySubs: number;
  yearlySubs: number;
  estMrrCents: number; // estimated monthly recurring revenue, in cents
}

// Aggregate everything for the admin dashboard (service-role; bypasses RLS).
export async function getAdminStats(): Promise<AdminStats> {
  const svc = svcHeaders();
  const [profilesRes, usageRes, subsRes] = await Promise.all([
    fetch(`${URL}/rest/v1/profiles?select=id,email,plan,role,last_seen_at&limit=10000`, { headers: svc }),
    fetch(`${URL}/rest/v1/usage_monthly?select=user_id,period,message_count&limit=100000`, { headers: svc }),
    fetch(`${URL}/rest/v1/subscriptions?select=status,price_interval&limit=10000`, { headers: svc }),
  ]);
  const profiles: any[] = (await profilesRes.json().catch(() => [])) || [];
  const usage: any[] = (await usageRes.json().catch(() => [])) || [];
  const subs: any[] = (await subsRes.json().catch(() => [])) || [];

  const activeSubs = subs.filter((s) => s.status === 'active' || s.status === 'trialing');
  const monthlySubs = activeSubs.filter((s) => s.price_interval === 'month').length;
  const yearlySubs = activeSubs.filter((s) => s.price_interval === 'year').length;
  // $3.99/mo and $19.99/yr → monthly-equivalent cents.
  const estMrrCents = monthlySubs * 399 + yearlySubs * Math.round(1999 / 12);

  const p = period();
  const emailById = new Map<string, string>(profiles.map((r) => [r.id, r.email]));

  const messagesThisMonthByUser = new Map<string, number>();
  let messagesAllTime = 0;
  for (const u of usage) {
    messagesAllTime += u.message_count || 0;
    if (u.period === p) messagesThisMonthByUser.set(u.user_id, (u.message_count || 0));
  }
  const messagesThisMonth = [...messagesThisMonthByUser.values()].reduce((a, b) => a + b, 0);

  const topUsers = [...messagesThisMonthByUser.entries()]
    .map(([id, messages]) => ({ email: emailById.get(id) || '(unknown)', messages }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 10);

  // Page views (optional table).
  let pageViews: number | null = null;
  try {
    const pv = await fetch(`${URL}/rest/v1/page_views?select=id`, {
      headers: { ...svc, Prefer: 'count=exact', Range: '0-0' },
    });
    if (pv.ok) {
      const cr = pv.headers.get('content-range'); // "0-0/123" or "*/0"
      const total = cr ? Number(cr.split('/')[1]) : NaN;
      pageViews = Number.isFinite(total) ? total : null;
    }
  } catch {
    pageViews = null;
  }

  return {
    totalAccounts: profiles.length,
    proSubscribers: profiles.filter((r) => r.plan === 'pro').length,
    admins: profiles.filter((r) => r.role === 'admin').length,
    activeThisMonth: messagesThisMonthByUser.size,
    loggedInEver: profiles.filter((r) => r.last_seen_at).length,
    messagesThisMonth,
    messagesAllTime,
    pageViews,
    topUsers,
    monthlySubs,
    yearlySubs,
    estMrrCents,
  };
}
