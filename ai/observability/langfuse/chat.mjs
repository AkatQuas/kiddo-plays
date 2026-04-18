//@ts-check
import { observeOpenAI } from '@langfuse/openai';
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing';
import OpenAI from 'openai';
import { sdk } from './instrumentation.mjs'; // Must be the first import

sdk.start();

const formatDate = () => {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
};

// Tool definitions for OpenAI function calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description:
        'Perform basic arithmetic calculations. Use for any math operations.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'Mathematical expression to evaluate (e.g., "5 + 3", "10 * 2", "100 / 4")'
          }
        },
        required: ['expression']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'weather',
      description: 'Get current weather information for a city.',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description:
              'City name to get weather for (e.g., "Tokyo", "New York", "London")'
          }
        },
        required: ['city']
      }
    }
  }
];

// Tool implementations
const toolImplementations = {
  calculator: (args) => {
    const { expression } = args;
    // Safe evaluation of math expressions
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
    try {
      // Use Function constructor for safe evaluation
      const result = new Function('return ' + sanitized)();
      return { success: true, result: result, expression };
    } catch (e) {
      return { success: false, error: e.message, expression };
    }
  },

  weather: (args) => {
    const { city } = args;
    // Mock weather data - can be extended with real API
    const weatherData = {
      tokyo: { temp: 18, condition: 'Partly Cloudy', humidity: 65 },
      'new york': { temp: 12, condition: 'Rainy', humidity: 80 },
      london: { temp: 10, condition: 'Cloudy', humidity: 75 },
      'san francisco': { temp: 15, condition: 'Foggy', humidity: 82 },
      sydney: { temp: 24, condition: 'Sunny', humidity: 45 }
    };
    const normalizedCity = city.toLowerCase();
    const data = weatherData[normalizedCity];
    if (data) {
      return { success: true, city, ...data };
    }
    return { success: false, error: 'City not found', city };
  }
};

function executeTool(toolCall) {
  const toolName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  const impl = toolImplementations[toolName];
  if (!impl) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  return impl(args);
}

async function chat() {
  const openai_raw = new OpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: {}
  });
  const model = 'minimax-m2.5';

  return startActiveObservation('chat', async (span) => {
    // Propagate trace attributes
    await propagateAttributes(
      {
        traceName: `Chat-${formatDate()}`,
        metadata: { env: 'development' },
        release: 'v0.0.2'
      },
      async () => {}
    );
    let messages = [
      {
        role: 'system',
        content:
          'You are a helpful assistant that can use tools to answer questions. When you have all the information needed, provide your final answer.'
      }
    ];

    const userMessage = {
      role: 'user',
      content: 'What is 3 + 8? And what is the weather in London?'
    };
    messages.push(userMessage);

    let round = 0;

    // Multi-round loop: continue until no more tool calls
    while (true) {
      round++;

      const openai = observeOpenAI(openai_raw, {
        parent: span,
        generationName: `Round-${round}`
      });
      const completion = await openai.chat.completions.create({
        messages,
        model,
        tools: tools,
        stream: false
      });

      const response = completion.choices[0].message;
      console.log('Assistant:', response.content || '(no content)');
      console.log('Tool calls:', response.tool_calls?.length || 0);

      // Add assistant message to conversation
      messages.push({
        role: response.role,
        content: response.content,
        tool_calls: response.tool_calls
      });

      // Check if assistant made tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Execute each tool call
        for (const toolCall of response.tool_calls) {
          console.log(`Calling tool: ${toolCall.function.name}`);
          const toolResult = executeTool(toolCall);
          console.log('Tool result:', toolResult);

          // Add tool result to conversation
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        // Continue the loop for next round
      } else {
        // No tool calls - this is the final response
        console.log(`\nFinal response: ${response.content || 'No response'}`);
        span.update({
          input: messages[1].content,
          output: messages[messages.length - 1].content
        });
        return response.content;
      }
    }
  };);
}

async function main() {
  try {
    const result = await chat();
    console.log('Result => \n' + result);
    await sdk.shutdown();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
