import { loadTranslation } from './loader';
import type { BibleData, ResolvedVerse, VerseRef } from './types';

export * from './types';
export { loadTranslation, BUNDLED_TRANSLATION_IDS, isBundledTranslation } from './loader';

// Canonical 66-book order, matching the keys in the bundled JSON.
export const CANONICAL_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges',
  'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles',
  '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Songs', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew',
  'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude',
  'Revelation',
];

// Reduce any book-name spelling to a canonical comparison key.
function normKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/\bfirst\b|\b1st\b/g, '1')
    .replace(/\bsecond\b|\b2nd\b/g, '2')
    .replace(/\bthird\b|\b3rd\b/g, '3')
    .replace(/[^a-z0-9]/g, '');
}

// Extra spellings the model might use that don't normalize to the canonical key.
const ALIAS_EXTRA: Record<string, string> = {
  psalm: 'Psalms',
  songofsolomon: 'Song of Songs',
  canticles: 'Song of Songs',
  ecclesiastesthepreacher: 'Ecclesiastes',
  revelations: 'Revelation',
  revelationofjohn: 'Revelation',
  actsoftheapostles: 'Acts',
  // common short forms
  gen: 'Genesis', exo: 'Exodus', lev: 'Leviticus', num: 'Numbers',
  deut: 'Deuteronomy', deu: 'Deuteronomy', josh: 'Joshua', judg: 'Judges',
  '1sam': '1 Samuel', '2sam': '2 Samuel', ps: 'Psalms', psa: 'Psalms',
  prov: 'Proverbs', eccl: 'Ecclesiastes', isa: 'Isaiah', jer: 'Jeremiah',
  ezek: 'Ezekiel', dan: 'Daniel', matt: 'Matthew', mt: 'Matthew',
  rom: 'Romans', '1cor': '1 Corinthians', '2cor': '2 Corinthians',
  gal: 'Galatians', eph: 'Ephesians', phil: 'Philippians', php: 'Philippians',
  col: 'Colossians', '1thess': '1 Thessalonians', '2thess': '2 Thessalonians',
  heb: 'Hebrews', rev: 'Revelation', phlm: 'Philemon',
};

// Built once: normalized canonical names + aliases -> canonical name.
const BOOK_LOOKUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const book of CANONICAL_BOOKS) map[normKey(book)] = book;
  for (const [alias, book] of Object.entries(ALIAS_EXTRA)) map[normKey(alias)] = book;
  return map;
})();

export function resolveBookName(input: string): string | null {
  return BOOK_LOOKUP[normKey(input)] ?? null;
}

function formatCitation(book: string, chapter: number, start: number, end?: number): string {
  return end && end > start
    ? `${book} ${chapter}:${start}-${end}`
    : `${book} ${chapter}:${start}`;
}

// Resolve one reference against the dataset. Returns null (so callers can DROP
// it) if the book/chapter/verse can't be found — this is what guarantees that
// every displayed citation is backed by real, bundled text.
export function resolveRefIn(data: BibleData, ref: VerseRef): ResolvedVerse | null {
  const book = resolveBookName(ref.book);
  if (!book) return null;

  const chapters = data.books[book];
  if (!chapters) return null;

  const verses = chapters[String(ref.chapter)];
  if (!verses) return null;

  const start = ref.verseStart;
  const requestedEnd = ref.verseEnd && ref.verseEnd > start ? ref.verseEnd : start;

  // The start verse must exist, or we drop the reference entirely (this is the
  // anti-hallucination guarantee). For a range, resolve the CONTIGUOUS run from
  // the start and stop at the first gap — some translations omit certain verses
  // (e.g. ASV omits Mark 11:26), and we'd rather show the valid opening verse
  // than throw the whole reference away. The citation is adjusted to match
  // exactly what we display, so the text and citation never disagree.
  const startText = verses[String(start)];
  if (!startText) return null;

  const parts = [startText];
  let actualEnd = start;
  for (let v = start + 1; v <= requestedEnd; v++) {
    const t = verses[String(v)];
    if (!t) break; // translation omits this verse — end the contiguous run here
    parts.push(t);
    actualEnd = v;
  }
  const end = actualEnd > start ? actualEnd : undefined;

  return {
    book,
    chapter: ref.chapter,
    verseStart: start,
    verseEnd: end,
    citation: formatCitation(book, ref.chapter, start, end),
    text: parts.join(' '),
    translationId: data.id,
    translationName: data.name,
  };
}

// Convenience: resolve against a bundled translation id.
export async function resolveRef(translationId: string, ref: VerseRef): Promise<ResolvedVerse | null> {
  const data = await loadTranslation(translationId);
  return resolveRefIn(data, ref);
}

// Surrounding verses for the "tap to expand context" feature.
export interface ContextVerse {
  verse: number;
  text: string;
  highlighted: boolean;
}

export async function getContext(
  translationId: string,
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | undefined,
  pad = 2,
): Promise<{ citation: string; reference: string; verses: ContextVerse[] } | null> {
  const data = await loadTranslation(translationId);
  const canonical = resolveBookName(book);
  if (!canonical) return null;
  const verses = data.books[canonical]?.[String(chapter)];
  if (!verses) return null;

  const last = verseEnd ?? verseStart;
  const from = Math.max(1, verseStart - pad);
  const to = last + pad;

  const out: ContextVerse[] = [];
  for (let v = from; v <= to; v++) {
    const t = verses[String(v)];
    if (!t) continue; // ran off the end of the chapter — fine
    out.push({ verse: v, text: t, highlighted: v >= verseStart && v <= last });
  }
  if (out.length === 0) return null;

  return {
    citation: formatCitation(canonical, chapter, verseStart, verseEnd),
    reference: `${canonical} ${chapter}`,
    verses: out,
  };
}
