// Shape returned by /search for each grounded result.
export interface SearchResult {
  citation: string; // "John 3:16"
  text: string; // exact verse text from the dataset
  reason: string; // one-line "why it fits"
  translationId: string;
  translationName: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
}

export interface SearchResponse {
  query: string;
  translationId: string;
  results: SearchResult[];
  noStrongMatch: boolean;
}

export interface ContextResponse {
  citation: string;
  reference: string;
  translationName: string;
  verses: { verse: number; text: string; highlighted: boolean }[];
}

// Web-only app: the site and its API routes are served from the same origin, so
// a relative path is all we need. We use GET with query params (not POST bodies)
// because the Expo server adapter does not reliably deliver request bodies on
// Vercel; reading them hangs the serverless function.
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'GET', headers: { accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as any)?.error || `Request failed (${res.status})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export function searchVerses(query: string, translationId: string): Promise<SearchResponse> {
  const qs = new URLSearchParams({ q: query, t: translationId }).toString();
  return getJson<SearchResponse>(`/search?${qs}`);
}

export function fetchContext(params: {
  translationId: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
}): Promise<ContextResponse> {
  const sp = new URLSearchParams({
    translationId: params.translationId,
    book: params.book,
    chapter: String(params.chapter),
    verseStart: String(params.verseStart),
  });
  if (params.verseEnd != null) sp.set('verseEnd', String(params.verseEnd));
  return getJson<ContextResponse>(`/context?${sp.toString()}`);
}
