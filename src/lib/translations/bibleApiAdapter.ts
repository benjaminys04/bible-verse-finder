import { resolveBookName } from '../bible';
import type { ResolvedVerse, VerseRef } from '../bible/types';
import type { ContextVerse } from '../bible';

// ─────────────────────────────────────────────────────────────────────────────
// Adapter for COPYRIGHTED / licensed translations (NIV, ESV, NLT, ...).
//
// These texts are NOT bundled because they are under copyright. This adapter
// fetches them from API.Bible (https://scripture.api.bible/) and is used ONLY
// when BIBLE_API_KEY is set AND the chosen translation is one you configured in
// BIBLE_API_TRANSLATIONS. Using copyrighted scripture text in production
// requires your own license/agreement with the rights holder — see the README.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.scripture.api.bible/v1';

// Canonical book name -> API.Bible USX book id.
const USX: Record<string, string> = {
  Genesis: 'GEN', Exodus: 'EXO', Leviticus: 'LEV', Numbers: 'NUM',
  Deuteronomy: 'DEU', Joshua: 'JOS', Judges: 'JDG', Ruth: 'RUT',
  '1 Samuel': '1SA', '2 Samuel': '2SA', '1 Kings': '1KI', '2 Kings': '2KI',
  '1 Chronicles': '1CH', '2 Chronicles': '2CH', Ezra: 'EZR', Nehemiah: 'NEH',
  Esther: 'EST', Job: 'JOB', Psalms: 'PSA', Proverbs: 'PRO',
  Ecclesiastes: 'ECC', 'Song of Songs': 'SNG', Isaiah: 'ISA', Jeremiah: 'JER',
  Lamentations: 'LAM', Ezekiel: 'EZK', Daniel: 'DAN', Hosea: 'HOS', Joel: 'JOL',
  Amos: 'AMO', Obadiah: 'OBA', Jonah: 'JON', Micah: 'MIC', Nahum: 'NAM',
  Habakkuk: 'HAB', Zephaniah: 'ZEP', Haggai: 'HAG', Zechariah: 'ZEC',
  Malachi: 'MAL', Matthew: 'MAT', Mark: 'MRK', Luke: 'LUK', John: 'JHN',
  Acts: 'ACT', Romans: 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO',
  Galatians: 'GAL', Ephesians: 'EPH', Philippians: 'PHP', Colossians: 'COL',
  '1 Thessalonians': '1TH', '2 Thessalonians': '2TH', '1 Timothy': '1TI',
  '2 Timothy': '2TI', Titus: 'TIT', Philemon: 'PHM', Hebrews: 'HEB',
  James: 'JAS', '1 Peter': '1PE', '2 Peter': '2PE', '1 John': '1JN',
  '2 John': '2JN', '3 John': '3JN', Jude: 'JUD', Revelation: 'REV',
};

export interface LicensedTranslation {
  id: string; // app-facing id, e.g. "niv"
  name: string; // label
  bibleId: string; // API.Bible bible id
}

function cleanText(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

async function fetchPassage(
  apiKey: string,
  bibleId: string,
  passageId: string,
  includeNumbers: boolean,
): Promise<{ content: string; reference: string } | null> {
  const url =
    `${API_BASE}/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}` +
    `?content-type=text&include-notes=false&include-titles=false` +
    `&include-chapter-numbers=false&include-verse-numbers=${includeNumbers}`;
  const res = await fetch(url, { headers: { 'api-key': apiKey } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.data?.content) return null;
  return { content: data.data.content, reference: data.data.reference || '' };
}

export async function resolveRefViaApi(
  apiKey: string,
  t: LicensedTranslation,
  ref: VerseRef,
): Promise<ResolvedVerse | null> {
  const book = resolveBookName(ref.book);
  if (!book) return null;
  const usx = USX[book];
  if (!usx) return null;

  const start = ref.verseStart;
  const end = ref.verseEnd && ref.verseEnd > start ? ref.verseEnd : undefined;
  const passageId = end
    ? `${usx}.${ref.chapter}.${start}-${usx}.${ref.chapter}.${end}`
    : `${usx}.${ref.chapter}.${start}`;

  const passage = await fetchPassage(apiKey, t.bibleId, passageId, false);
  if (!passage) return null;

  const text = cleanText(passage.content);
  if (!text) return null;

  return {
    book,
    chapter: ref.chapter,
    verseStart: start,
    verseEnd: end,
    citation: end ? `${book} ${ref.chapter}:${start}-${end}` : `${book} ${ref.chapter}:${start}`,
    text,
    translationId: t.id,
    translationName: t.name,
  };
}

export async function getContextViaApi(
  apiKey: string,
  t: LicensedTranslation,
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | undefined,
  pad = 2,
): Promise<{ citation: string; reference: string; verses: ContextVerse[] } | null> {
  const canonical = resolveBookName(book);
  if (!canonical) return null;
  const usx = USX[canonical];
  if (!usx) return null;

  const last = verseEnd ?? verseStart;
  const from = Math.max(1, verseStart - pad);
  const to = last + pad;
  const passageId = `${usx}.${chapter}.${from}-${usx}.${chapter}.${to}`;

  // We can't reliably split API.Bible plain text back into numbered verses, so
  // we return the padded passage as a single highlighted block.
  const passage = await fetchPassage(apiKey, t.bibleId, passageId, false);
  if (!passage) return null;
  const text = cleanText(passage.content);
  if (!text) return null;

  return {
    citation: verseEnd ? `${canonical} ${chapter}:${verseStart}-${verseEnd}` : `${canonical} ${chapter}:${verseStart}`,
    reference: `${canonical} ${chapter}`,
    verses: [{ verse: from, text, highlighted: true }],
  };
}
