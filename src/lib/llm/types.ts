// One reference as proposed by the model. Note: NO verse text — only a pointer.
// The server resolves the text from the trusted dataset.
export interface LlmVerseRef {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  reason: string; // one short line on why it fits the user's input
}

export interface LlmResult {
  refs: LlmVerseRef[];
  // True when the model judged that nothing in scripture is a strong match,
  // so the UI can show a gentle "try rephrasing" state.
  noStrongMatch: boolean;
}

export interface LlmProvider {
  name: string;
  // Ask the model for grounded references. `avoid` lists citations already tried
  // (so a retry round can request fresh ones when some failed to resolve).
  suggest(query: string, count: number, avoid: string[]): Promise<LlmResult>;
}
