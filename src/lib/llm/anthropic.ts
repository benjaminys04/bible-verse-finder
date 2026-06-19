import type { LlmProvider, LlmResult } from './types';
import {
  SYSTEM_PROMPT,
  TOOL_NAME,
  TOOL_INPUT_SCHEMA,
  buildUserMessage,
  normalizePayload,
} from './prompt';

// Anthropic Messages API adapter.
//
// We use raw fetch (not the SDK) on purpose: it keeps one small code path per
// provider, avoids bundling a Node SDK into the Metro server target, and makes
// the provider trivially swappable. Forced JSON is achieved with tool use +
// tool_choice, so the model cannot free-type verse text. We intentionally omit
// sampling params (temperature/top_p) so this works on every current model,
// including Opus 4.x where those params are rejected.
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5';

export function createAnthropicProvider(apiKey: string, model?: string): LlmProvider {
  const useModel = model || DEFAULT_MODEL;

  return {
    name: 'anthropic',
    async suggest(query: string, count: number, avoid: string[]): Promise<LlmResult> {
      const body = {
        model: useModel,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: TOOL_NAME,
            description: 'Return the chosen Bible verse references (no verse text).',
            input_schema: TOOL_INPUT_SCHEMA,
          },
        ],
        // Force the model to call our tool, guaranteeing structured output.
        tool_choice: { type: 'tool', name: TOOL_NAME },
        messages: [{ role: 'user', content: buildUserMessage(query, count, avoid) }],
      };

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        // Defensive timeout so a slow model can never hang the serverless route.
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`);
      }

      const data = await res.json();
      const toolUse = Array.isArray(data?.content)
        ? data.content.find((b: any) => b.type === 'tool_use' && b.name === TOOL_NAME)
        : undefined;

      if (!toolUse?.input) {
        throw new Error('Anthropic response did not include the expected tool call.');
      }

      const { refs, noStrongMatch } = normalizePayload(toolUse.input);
      return { refs, noStrongMatch };
    },
  };
}
