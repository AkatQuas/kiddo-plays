//@ts-check
import { trace } from '@opentelemetry/api';
import OpenAI from 'openai';

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

async function executeTool(toolCall, tracer) {
  const toolName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  return tracer.startActiveSpan(`tool:${toolName}`, async (span) => {
    try {
      span.setAttribute('ag.type.node', 'tool');
      span.setAttribute('ag.data.inputs', JSON.stringify(args));

      const impl = toolImplementations[toolName];
      if (!impl) {
        const result = { success: false, error: `Unknown tool: ${toolName}` };
        span.setAttribute('ag.data.outputs', JSON.stringify(result));
        return result;
      }

      const result = impl(args);
      span.setAttribute('ag.data.outputs', JSON.stringify(result));
      return result;
    } finally {
      span.end();
    }
  });
}

async function chat() {
  const openai = new OpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY
  });
  const model = 'minimax-m2.5';

  const tracer = trace.getTracer('test', '1.0.0');
  // Create a span for the entire conversation
  return tracer.startActiveSpan('agent', async (span) => {
    try {
      // Set span type
      span.setAttribute('ag.type.node', 'workflow');

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

      // Log inputs
      span.setAttribute(
        'ag.data.inputs',
        JSON.stringify({
          messages: messages,
          model,
          tools: tools.map((t) => t.function.name)
        })
      );

      let finalContent = '';
      let round = 0;

      // Multi-round loop: continue until no more tool calls
      while (true) {
        round++;
        console.log(`\n--- Round ${round} ---`);

        let response;
        // Create a span for this LLM call
        await tracer.startActiveSpan('chat', async (llmSpan) => {
          try {
            llmSpan.setAttribute('ag.type.node', 'chat');
            llmSpan.setAttribute('ag.data.inputs', JSON.stringify({ round }));

            const completion = await openai.chat.completions.create({
              messages,
              model,
              tools: tools,
              stream: false
            });

            response = completion.choices[0].message;
            llmSpan.setAttribute(
              'ag.data.outputs',
              JSON.stringify({
                role: response.role,
                content: response.content,
                toolCalls: response.tool_calls
              })
            );
          } finally {
            llmSpan.end();
          }
        });

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
            const toolResult = await executeTool(toolCall, tracer);

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
          finalContent = response.content || 'No response';
          console.log(`Final response: ${finalContent}`);
          break;
        }
      }

      // Set final outputs
      span.setAttribute(
        'ag.data.outputs',
        JSON.stringify({
          content: finalContent,
          rounds: round
        })
      );

      return finalContent;
    } finally {
      span.end();
    }
  });
}

async function main() {
  try {
    const result = await chat();
    console.log('Result => \n' + result);

    // Ensure traces are flushed before exit
    const tracerProvider = trace.getTracerProvider();
    if (tracerProvider && typeof tracerProvider.forceFlush === 'function') {
      console.log('\nFlushing traces...');
      await tracerProvider.forceFlush();
    }
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
