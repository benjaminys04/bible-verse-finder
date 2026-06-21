// Server-only Supabase access for metering + admin. Uses the SECRET (service
// role) key, which bypasses Row Level Security, so it must NEVER be imported by
// client code — only by API routes (app/*+api.ts). Plain fetch (no SDK).

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
  const plan = profile?.plan ?? 'free';
  return { unlimited: role === 'admin' || plan === 'pro', role, plan };
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
