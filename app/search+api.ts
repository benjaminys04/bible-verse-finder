import { getProvider } from '../src/lib/llm';
import type { LlmVerseRef } from '../src/lib/llm';
import {
  resolveReference,
  getAvailableTranslations,
  DEFAULT_TRANSLATION_ID,
} from '../src/lib/translations/registry';
import type { ResolvedVerse } from '../src/lib/bible';
import { rateLimit, clientKey } from '../src/lib/rateLimit';
import {
  adminConfigured,
  getUserFromToken,
  getEntitlement,
  getUsage,
  incrementUsage,
  FREE_MONTHLY_LIMIT,
} from '../src/lib/supabaseAdmin';

// GET /search?q=<text>&t=<translationId>
//
// NOTE: this is a GET (query params), not a POST with a JSON body. The Expo
// Router server adapter for Vercel does not reliably deliver a request body to
// API routes on Vercel's runtime (reading it hangs the function), so we pass the
// small search payload in the query string instead. The verse text/citations
// still come only from the trusted dataset; unresolvable references are dropped
// and we make one backfill round toward the 3-7 target.

const TARGET = 7;
const MIN_GOOD = 3;
const NO_STORE = { 'cache-control': 'no-store' };

function refCitation(r: LlmVerseRef): string {
  return r.verse_end && r.verse_end > r.verse_start
    ? `${r.book} ${r.chapter}:${r.verse_start}-${r.verse_end}`
    : `${r.book} ${r.chapter}:${r.verse_start}`;
}

function toClient(resolved: ResolvedVerse, reason: string) {
  return {
    citation: resolved.citation,
    text: resolved.text,
    reason,
    translationId: resolved.translationId,
    translationName: resolved.translationName,
    book: resolved.book,
    chapter: resolved.chapter,
    verseStart: resolved.verseStart,
    verseEnd: resolved.verseEnd,
  };
}

export async function GET(request: Request): Promise<Response> {
  // Basic rate limiting to protect the API key.
  const rl = rateLimit(clientKey(request));
  if (!rl.ok) {
    return Response.json(
      { error: 'You are searching a little fast. Please wait a moment and try again.' },
      { status: 429, headers: { ...NO_STORE, 'retry-after': String(rl.retryAfter) } },
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const requested = url.searchParams.get('t') || DEFAULT_TRANSLATION_ID;
  const translation = getAvailableTranslations().some((t) => t.id === requested)
    ? requested
    : DEFAULT_TRANSLATION_ID;

  if (!query) {
    return Response.json({ error: 'Please type something first.' }, { status: 400, headers: NO_STORE });
  }
  if (query.length > 500) {
    return Response.json(
      { error: 'That is a bit long. Try a shorter phrase.' },
      { status: 400, headers: NO_STORE },
    );
  }

  // --- Accounts + free-tier metering (active once Supabase is configured) ---
  // Require a logged-in account; free users get FREE_MONTHLY_LIMIT messages/month;
  // Pro and Admin are unlimited. The admin email is auto-granted admin.
  let authedUserId: string | null = null;
  if (adminConfigured()) {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return Response.json(
        { error: 'Create a free account to start — you get 10 free messages a month.', code: 'auth_required' },
        { status: 401, headers: NO_STORE },
      );
    }
    authedUserId = user.id;
    const entitlement = await getEntitlement(user);
    if (!entitlement.unlimited) {
      const used = await getUsage(user.id);
      if (used >= FREE_MONTHLY_LIMIT) {
        return Response.json(
          {
            error: `You've used all ${FREE_MONTHLY_LIMIT} free messages this month. Upgrade to Pro for unlimited.`,
            code: 'limit_reached',
          },
          { status: 403, headers: NO_STORE },
        );
      }
    }
  }

  let provider;
  try {
    provider = getProvider();
  } catch (e: any) {
    return Response.json({ error: e?.message || 'LLM is not configured.' }, { status: 500, headers: NO_STORE });
  }

  try {
    const collected: { resolved: ResolvedVerse; reason: string }[] = [];
    const seenCitations = new Set<string>();
    const avoid: string[] = [];
    let noStrongMatch = false;

    // Up to two rounds: initial + one backfill if too many references failed to
    // resolve against the dataset.
    for (let round = 0; round < 2; round++) {
      if (TARGET - collected.length <= 0) break;

      const result = await provider.suggest(query, TARGET, avoid);
      if (result.noStrongMatch && collected.length === 0) {
        noStrongMatch = true;
        break;
      }

      let addedThisRound = 0;
      for (const ref of result.refs) {
        if (collected.length >= TARGET) break;
        if (!ref.book || !Number.isFinite(ref.chapter) || !Number.isFinite(ref.verse_start)) continue;

        avoid.push(refCitation(ref)); // don't re-suggest, resolved or not

        const resolved = await resolveReference(translation, {
          book: ref.book,
          chapter: ref.chapter,
          verseStart: ref.verse_start,
          verseEnd: ref.verse_end,
        });
        if (!resolved) continue; // DROP unresolved -> guarantees real citations

        if (seenCitations.has(resolved.citation)) continue;
        seenCitations.add(resolved.citation);
        collected.push({ resolved, reason: ref.reason });
        addedThisRound++;
      }

      if (collected.length >= MIN_GOOD || addedThisRound === 0) break;
    }

    // Count this query as one "message" for the user (used for the free-tier
    // limit and the admin per-user totals). Don't let a metering hiccup fail the
    // search the user already paid attention to.
    if (authedUserId) await incrementUsage(authedUserId).catch(() => {});

    if (noStrongMatch || collected.length === 0) {
      return Response.json(
        { query, translationId: translation, results: [], noStrongMatch: true },
        { headers: NO_STORE },
      );
    }

    return Response.json(
      {
        query,
        translationId: translation,
        results: collected.slice(0, TARGET).map((c) => toClient(c.resolved, c.reason)),
        noStrongMatch: false,
      },
      { headers: NO_STORE },
    );
  } catch (e: any) {
    return Response.json(
      { error: e?.message || 'Something went wrong finding verses. Please try again.' },
      { status: 502, headers: NO_STORE },
    );
  }
}
