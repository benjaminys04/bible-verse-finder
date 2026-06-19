import { getContext, resolveRef, isBundledTranslation } from '../bible';
import type { ResolvedVerse, VerseRef, ContextVerse } from '../bible';
import {
  resolveRefViaApi,
  getContextViaApi,
  type LicensedTranslation,
} from './bibleApiAdapter';
import { BUNDLED_TRANSLATIONS, DEFAULT_TRANSLATION_ID, type TranslationInfo } from './shared';

export { BUNDLED_TRANSLATIONS, DEFAULT_TRANSLATION_ID };
export type { TranslationInfo };

// Parse BIBLE_API_TRANSLATIONS="id:Label:bibleId,id2:Label2:bibleId2".
function parseLicensed(): LicensedTranslation[] {
  const raw: string | undefined = process.env.BIBLE_API_TRANSLATIONS;
  if (!raw || !process.env.BIBLE_API_KEY) return [];
  return raw
    .split(',')
    .map((entry: string) => entry.trim())
    .filter(Boolean)
    .map((entry: string): LicensedTranslation | null => {
      const [id, name, bibleId] = entry.split(':').map((s: string) => s?.trim());
      if (!id || !name || !bibleId) return null;
      return { id, name, bibleId };
    })
    .filter((x): x is LicensedTranslation => x !== null);
}

function licensedInfo(): TranslationInfo[] {
  return parseLicensed().map((t) => ({
    id: t.id,
    name: t.name,
    abbreviation: t.id.toUpperCase(),
    license: 'Licensed via API.Bible (requires your own license)',
    kind: 'licensed' as const,
  }));
}

// Full list for the picker: bundled first, then any configured licensed ones.
export function getAvailableTranslations(): TranslationInfo[] {
  return [...BUNDLED_TRANSLATIONS, ...licensedInfo()];
}

export function getTranslationName(id: string): string {
  return getAvailableTranslations().find((t) => t.id === id)?.name ?? id.toUpperCase();
}

// Resolve a single reference against whichever translation was chosen, picking
// the bundled lookup or the licensed API adapter automatically. Returns null so
// callers DROP unresolved references (the anti-hallucination guarantee).
export async function resolveReference(
  translationId: string,
  ref: VerseRef,
): Promise<ResolvedVerse | null> {
  if (isBundledTranslation(translationId)) {
    return resolveRef(translationId, ref);
  }
  const licensed = parseLicensed().find((t) => t.id === translationId);
  if (licensed && process.env.BIBLE_API_KEY) {
    return resolveRefViaApi(process.env.BIBLE_API_KEY, licensed, ref);
  }
  return null;
}

export async function getContextFor(
  translationId: string,
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | undefined,
): Promise<{ citation: string; reference: string; verses: ContextVerse[] } | null> {
  if (isBundledTranslation(translationId)) {
    return getContext(translationId, book, chapter, verseStart, verseEnd);
  }
  const licensed = parseLicensed().find((t) => t.id === translationId);
  if (licensed && process.env.BIBLE_API_KEY) {
    return getContextViaApi(process.env.BIBLE_API_KEY, licensed, book, chapter, verseStart, verseEnd);
  }
  return null;
}
