// Supabase access via its REST API (GoTrue for auth, PostgREST for data) using
// plain fetch. We deliberately avoid @supabase/supabase-js: it doesn't bundle
// under Expo/Metro (pulls in @opentelemetry/api). The URL + publishable (anon)
// key are public and inlined at build time via the EXPO_PUBLIC_ prefix.

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = Boolean(URL && ANON);

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  user: { id: string; email: string };
}

export interface Profile {
  id: string;
  email: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
}

function toSession(d: any): Session {
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (d.expires_in ?? 3600),
    user: { id: d.user?.id ?? '', email: d.user?.email ?? '' },
  };
}

async function authPost(path: string, body: unknown, token?: string): Promise<any> {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: ANON,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error_description || data?.msg || data?.message || `Request failed (${res.status})`);
  }
  return data;
}

// Returns a session, or null + needsConfirm when the project requires email
// confirmation before the first login.
export async function signUp(email: string, password: string): Promise<{ session: Session | null; needsConfirm: boolean }> {
  // Point the email-confirmation link at the live site (this origin) rather than
  // the project's default Site URL. The target must also be allow-listed in
  // Supabase → Auth → URL Configuration → Redirect URLs, or GoTrue ignores it.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = origin ? `signup?redirect_to=${encodeURIComponent(origin + '/account')}` : 'signup';
  const d = await authPost(path, { email, password });
  if (d.access_token) return { session: toSession(d), needsConfirm: false };
  return { session: null, needsConfirm: true };
}

export async function signIn(email: string, password: string): Promise<Session> {
  return toSession(await authPost('token?grant_type=password', { email, password }));
}

export async function refreshSession(refresh_token: string): Promise<Session> {
  return toSession(await authPost('token?grant_type=refresh_token', { refresh_token }));
}

export async function signOut(access_token: string): Promise<void> {
  try {
    await authPost('logout', {}, access_token);
  } catch {
    /* best effort */
  }
}

// PostgREST read of the caller's own rows (Row Level Security enforces ownership).
async function restGet(path: string, access_token: string): Promise<any[]> {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, authorization: `Bearer ${access_token}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

export async function getProfile(s: Session): Promise<Profile | null> {
  const rows = await restGet(`profiles?select=id,email,role,plan&id=eq.${s.user.id}`, s.access_token);
  return (rows[0] as Profile) ?? null;
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM' (UTC)
}

export async function getMonthlyUsage(s: Session): Promise<number> {
  const rows = await restGet(
    `usage_monthly?select=message_count&user_id=eq.${s.user.id}&period=eq.${currentPeriod()}`,
    s.access_token,
  );
  return rows[0]?.message_count ?? 0;
}

// Stamp last_seen on the user's own profile (RLS allows own-profile update).
export async function touchLastSeen(s: Session): Promise<void> {
  await fetch(`${URL}/rest/v1/profiles?id=eq.${s.user.id}`, {
    method: 'PATCH',
    headers: {
      apikey: ANON,
      authorization: `Bearer ${s.access_token}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  }).catch(() => {});
}
