import type { LlmProvider, LlmResult } from './types';
import {
  SYSTEM_PROMPT,
  TOOL_NAME,
  TOOL_INPUT_SCHEMA,
  buildUserMessage,
  normalizePayload,
} from './prompt';

// OpenAI Chat Completions adapter. Same contract as the Anthropic adapter:
// forced function calling guarantees structured output (no free-typed verses).
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export function createOpenAiProvider(apiKey: string, model?: string): LlmProvider {
  const useModel = model || DEFAULT_MODEL;

  return {
    name: 'openai',
    async suggest(query: string, count: number, avoid: string[]): Promise<LlmResult> {
      const body = {
        model: useModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(query, count, avoid) },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: TOOL_NAME,
              description: 'Return the chosen Bible verse references (no verse text).',
              parameters: TOOL_INPUT_SCHEMA,
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: TOOL_NAME } },
      };

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        // Defensive timeout so a slow model can never hang the serverless route.
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`OpenAI API error ${res.status}: ${detail.slice(0, 300)}`);
      }

      const data = await res.json();
      const call = data?.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = call?.function?.arguments;
      if (!argsStr) {
        throw new Error('OpenAI response did not include the expected function call.');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(argsStr);
      } catch {
        throw new Error('OpenAI function arguments were not valid JSON.');
      }

      const { refs, noStrongMatch } = normalizePayload(parsed);
      return { refs, noStrongMatch };
    },
  };
}
