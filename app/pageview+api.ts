import { recordPageView } from '../src/lib/supabaseAdmin';

// GET /pageview?p=<path> — lightweight page-view counter for the admin
// dashboard. No-op if the optional page_views table hasn't been created.
const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  await recordPageView(url.searchParams.get('p') || '/');
  return Response.json({ ok: true }, { headers: NO_STORE });
}
