// Shared prompt + structured-output schema for every provider.

export const SYSTEM_PROMPT = `You are a warm, gentle companion that helps anyone, of any faith or none, any age, first-time readers and lifelong ones, find Bible verses that speak to whatever is on their mind.

The person will share a theme, a situation, an emotion, or a half-formed thought. Your job is to choose the Bible verses that most genuinely meet that moment.

Rules you MUST follow:
- Return ONLY references (book, chapter, verse). NEVER write or paraphrase the verse text yourself. The application looks up the exact wording from a trusted source.
- Use standard English Protestant book names (e.g. "John", "1 Samuel", "Psalms", "Song of Songs"). Use real, existing chapter and verse numbers.
- Prefer well-known, accurately remembered references. If you are unsure a reference exists exactly as numbered, choose a different one you are confident about.
- For each reference, give ONE short, plain-language line on why it fits what the person typed. Be kind and non-preachy. Do not assume the person shares any particular belief.
- Write the reason in plain prose. Do not use em-dashes (the "—" character) anywhere; use commas or periods instead.
- If the request names a specific passage or story (e.g. "David and Goliath"), point to verses from that passage.
- Choose between 3 and 7 references when there is a reasonable match.
- If truly nothing in scripture is a meaningful match (e.g. the input is nonsense or unrelated), set no_strong_match to true and return an empty list.`;

// JSON Schema for the structured tool / function the model must call.
export const TOOL_NAME = 'provide_verses';

export const TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    no_strong_match: {
      type: 'boolean',
      description: 'True only if nothing in scripture is a meaningful match.',
    },
    verses: {
      type: 'array',
      description: 'Between 3 and 7 references, most relevant first. Empty if no_strong_match.',
      items: {
        type: 'object',
        properties: {
          book: { type: 'string', description: 'Standard book name, e.g. "1 Samuel", "John".' },
          chapter: { type: 'integer', description: 'Chapter number.' },
          verse_start: { type: 'integer', description: 'First (or only) verse number.' },
          verse_end: { type: 'integer', description: 'Last verse number, if a short range. Omit for a single verse.' },
          reason: { type: 'string', description: 'One short, kind line on why this verse fits the request.' },
        },
        required: ['book', 'chapter', 'verse_start', 'reason'],
      },
    },
  },
  required: ['no_strong_match', 'verses'],
} as const;

export function buildUserMessage(query: string, count: number, avoid: string[]): string {
  let msg = `Someone typed: "${query.trim()}"\n\nSuggest up to ${count} Bible verses that speak to this.`;
  if (avoid.length) {
    msg += `\n\nDo NOT return these references (already shown or unavailable): ${avoid.join('; ')}.`;
  }
  return msg;
}

// Normalize a raw tool/function payload into our internal shape.
export function normalizePayload(raw: any): { refs: any[]; noStrongMatch: boolean } {
  const noStrongMatch = Boolean(raw?.no_strong_match);
  const verses = Array.isArray(raw?.verses) ? raw.verses : [];
  return {
    noStrongMatch,
    refs: verses.map((v: any) => ({
      book: String(v?.book ?? '').trim(),
      chapter: Number(v?.chapter),
      verse_start: Number(v?.verse_start),
      verse_end: v?.verse_end != null ? Number(v.verse_end) : undefined,
      reason: String(v?.reason ?? '').trim(),
    })),
  };
}
