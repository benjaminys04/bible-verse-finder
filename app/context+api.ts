import { getContextFor, getTranslationName, DEFAULT_TRANSLATION_ID } from '../src/lib/translations/registry';
import { rateLimit, clientKey } from '../src/lib/rateLimit';

// GET /context?translationId=&book=&chapter=&verseStart=&verseEnd=
//
// GET (query params), not POST, for the same Vercel adapter reason as /search.
// Returns the chosen verse(s) plus a couple of surrounding verses, all from the
// trusted dataset (or licensed API), for the "tap to expand context" view.
const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  const rl = rateLimit(clientKey(request));
  if (!rl.ok) {
    return Response.json({ error: 'Please wait a moment and try again.' }, { status: 429, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const translationId = url.searchParams.get('translationId') || DEFAULT_TRANSLATION_ID;
  const book = url.searchParams.get('book') || '';
  const chapter = Number(url.searchParams.get('chapter'));
  const verseStart = Number(url.searchParams.get('verseStart'));
  const verseEndRaw = url.searchParams.get('verseEnd');
  const verseEnd = verseEndRaw != null && verseEndRaw !== '' ? Number(verseEndRaw) : undefined;

  if (!book || !Number.isFinite(chapter) || !Number.isFinite(verseStart)) {
    return Response.json({ error: 'Invalid reference.' }, { status: 400, headers: NO_STORE });
  }

  try {
    const ctx = await getContextFor(translationId, book, chapter, verseStart, verseEnd);
    if (!ctx) {
      return Response.json({ error: 'Context is not available for this verse.' }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ ...ctx, translationName: getTranslationName(translationId) }, { headers: NO_STORE });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Could not load context.' }, { status: 502, headers: NO_STORE });
  }
}
