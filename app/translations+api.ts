import { getAvailableTranslations } from '../src/lib/translations/registry';

// GET /translations
// Lists the translations the picker should show: the bundled public-domain ones
// plus any licensed ones configured via env. Client-safe (no secrets).
export async function GET(): Promise<Response> {
  return Response.json({ translations: getAvailableTranslations() });
}
