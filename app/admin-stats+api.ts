import { adminConfigured, getUserFromToken, getEntitlement, getAdminStats } from '../src/lib/supabaseAdmin';

// GET /admin-stats — admin-only aggregate metrics for the dashboard.
const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  if (!adminConfigured()) {
    return Response.json({ error: 'Accounts are not configured.' }, { status: 500, headers: NO_STORE });
  }
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const user = token ? await getUserFromToken(token) : null;
  if (!user) {
    return Response.json({ error: 'Sign in required.' }, { status: 401, headers: NO_STORE });
  }
  const ent = await getEntitlement(user); // also auto-grants admin to ADMIN_EMAIL
  if (ent.role !== 'admin') {
    return Response.json({ error: 'Not authorized.' }, { status: 403, headers: NO_STORE });
  }
  return Response.json(await getAdminStats(), { headers: NO_STORE });
}
