import type { LlmProvider } from './types';
import { createAnthropicProvider } from './anthropic';
import { createOpenAiProvider } from './openai';

export * from './types';

// Build the configured provider from server env. Throws a friendly error if no
// key is set so the API route can return a clear message to the client.
export function getProvider(): LlmProvider {
  const provider = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
  const model = process.env.LLM_MODEL || undefined;

  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('LLM_PROVIDER=openai but OPENAI_API_KEY is not set.');
    return createOpenAiProvider(key, model);
  }

  // default: anthropic
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'No LLM key configured. Set ANTHROPIC_API_KEY (or set LLM_PROVIDER=openai and OPENAI_API_KEY) in your .env.',
    );
  }
  return createAnthropicProvider(key, model);
}
