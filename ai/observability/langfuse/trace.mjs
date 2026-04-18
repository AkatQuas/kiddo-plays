import { observeOpenAI } from '@langfuse/openai';
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing';
import OpenAI from 'openai';
import { sdk } from './instrumentation.mjs'; // Must be the first import

sdk.start();

const country = 'China';

const openai = new OpenAI();
await startActiveObservation('user-request', async (span) => {
  const capital = (
    await observeOpenAI(openai, {
      parent: span,
      generationName: 'get-capital'
    }).chat.completions.create({
      model: 'minimax-m2.5',
      messages: [
        { role: 'system', content: 'What is the capital of the country?' },
        { role: 'user', content: country }
      ]
    })
  ).choices[0].message.content;

  const poem = (
    await observeOpenAI(openai, {
      parent: span,
      generationName: 'generate-poem'
    }).chat.completions.create({
      model: 'minimax-m2.5',
      messages: [
        {
          role: 'system',
          content: 'You are a poet. Create a poem about this city.'
        },
        { role: 'user', content: capital }
      ]
    })
  ).choices[0].message.content;

  // Propagate trace attributes
  await propagateAttributes(
    {
      traceName: 'City poem generator',
      tags: ['updated'],
      metadata: { env: 'development' },
      release: 'v0.0.2'
    },
    async () => {}
  );

  // Set input and output on the root observation
  span.update({
    input: country,
    output: poem
  });
});

await sdk.shutdown();
