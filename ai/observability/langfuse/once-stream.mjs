import { observeOpenAI } from '@langfuse/openai';
import OpenAI from 'openai';
import { langfuseSpanProcessor, sdk } from './instrumentation.mjs'; // Must be the first import
sdk.start();

const openai = observeOpenAI(new OpenAI(), {
  generationName: 'OpenAI Trace: Completion Stream',
  tags: ['stream']
});

const stream = await openai.chat.completions.create({
  messages: [{ role: 'system', content: 'Tell me a story about a dog.' }],
  model: 'glm-5.1',
  stream: true,
  max_tokens: 300
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  console.log(content);
}

await langfuseSpanProcessor.forceFlush();
await sdk.shutdown();
