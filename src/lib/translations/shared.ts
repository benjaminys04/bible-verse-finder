// Client-safe translation metadata. This module must NOT import the verse
// loader or the API adapter, so it can be bundled into the client without
// pulling in the multi-megabyte JSON data or any server-only code.

export interface TranslationInfo {
  id: string;
  name: string;
  abbreviation: string;
  license: string;
  kind: 'bundled' | 'licensed';
}

export const BUNDLED_TRANSLATIONS: TranslationInfo[] = [
  { id: 'kjv', name: 'King James Version', abbreviation: 'KJV', license: 'Public Domain', kind: 'bundled' },
  { id: 'asv', name: 'American Standard Version', abbreviation: 'ASV', license: 'Public Domain', kind: 'bundled' },
  { id: 'web', name: 'World English Bible', abbreviation: 'WEB', license: 'Public Domain', kind: 'bundled' },
];

export const DEFAULT_TRANSLATION_ID = 'kjv';
