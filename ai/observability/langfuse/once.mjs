import { observeOpenAI } from '@langfuse/openai';
import OpenAI from 'openai';
import { langfuseSpanProcessor, sdk } from './instrumentation.mjs'; // Must be the first import
sdk.start();

const openai = observeOpenAI(new OpenAI(), {
  generationName: 'OpenAI Trace: Completion',
  tags: []
});

const res = await openai.chat.completions.create({
  messages: [{ role: 'system', content: 'Tell me a story about a dog.' }],
  model: 'glm-5.1',
  max_tokens: 300
});

await langfuseSpanProcessor.forceFlush();
await sdk.shutdown();
