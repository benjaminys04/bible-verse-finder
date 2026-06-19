// Shape of the bundled, normalized translation files in assets/bibles/*.json.
// Produced by scripts/build-bible.js. Nested for O(1) verse lookup:
//   data.books["John"]["3"]["16"] -> "For God so loved the world, ..."
export interface BibleData {
  id: string; // "kjv" | "web" | "asv"
  name: string; // "King James Version"
  abbreviation: string; // "KJV"
  license: string; // "Public Domain"
  books: Record<string, Record<string, Record<string, string>>>;
}

// A reference the LLM asked us to resolve.
export interface VerseRef {
  book: string; // free-form book name from the model, e.g. "1 Samuel", "Psalm"
  chapter: number;
  // Verses to include. A single verse -> { start: 16 }. A range -> { start: 1, end: 5 }.
  verseStart: number;
  verseEnd?: number;
}

// A fully resolved, grounded result ready for display. `text` and `citation`
// come from the trusted local dataset — never from the model.
export interface ResolvedVerse {
  book: string; // canonical book name, e.g. "1 Samuel"
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  citation: string; // "1 Samuel 1:5" or "John 3:16-17"
  text: string; // exact text joined from the dataset
  translationId: string;
  translationName: string;
}
