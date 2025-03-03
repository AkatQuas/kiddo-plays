import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { z } from 'zod';
import {
  AlertsResponse,
  ForecastPeriod,
  ForecastResponse,
  formatAlerts,
  formatForecast,
  makeNWSRequest,
  NWS_API_BASE,
  PointsResponse,
} from './helper.js';

// Create an MCP server
const server = new McpServer({
  name: 'weather',
  version: '1.0.0',
});

// Add 'get-alerts' tool
server.tool(
  'get-alerts',
  'get weather alerts for a state',
  {
    state: z.string().length(2).describe('Two letter state code (e.g. CA, NY)'),
  },
  async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);
    if (!alertsData) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to retrieve alerts data',
          },
        ],
      };
    }

    const { features = [] } = alertsData;
    if (features.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active alerts for' + stateCode,
          },
        ],
      };
    }

    const formattedAlerts = features.map(formatAlerts);

    const alertsText = `Active alerts for ${stateCode}:\n${formattedAlerts.join(
      '\n'
    )}`;
    return {
      content: [
        {
          type: 'text',
          text: alertsText,
        },
      ],
    };
  }
);

// Add 'get-forecast' tool
server.tool(
  'get-forecast',
  'Get weather forecast for a location',
  {
    latitude: z.number().min(-90).max(90).describe('Latitude of the location'),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe('Longitude of the location'),
  },
  async ({ latitude, longitude }) => {
    // Get grid point data
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(
      4
    )},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
          },
        ],
      };
    }

    const { forecast: forecastUrl } = pointsData.properties || {};
    if (!forecastUrl) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to get forecast URL from grid point data',
          },
        ],
      };
    }

    // Get forecast data
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
    if (!forecastData) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to retrieve forecast data',
          },
        ],
      };
    }

    const { periods = [] } = forecastData.properties || {};
    if (periods.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No forecast periods available',
          },
        ],
      };
    }

    // Format forecast periods
    const formattedForecast = periods.map(formatForecast);

    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join(
      '\n'
    )}`;

    return {
      content: [
        {
          type: 'text',
          text: forecastText,
        },
      ],
    };
  }
);

// Add an addition tool
server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: 'text', text: String(a + b) }],
}));

// Add a dynamic greeting resource
server.resource(
  'greeting',
  new ResourceTemplate('greeting://{name}', { list: undefined }),
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}!`,
      },
    ],
  })
);

// Add a prompt which is a reusable template that help LLMs interact with your server effectively
server.prompt(
  "review-code",
  { code: z.string() },
  ({ code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please review this code:\n\n${code}`
      }
    }]
  })
);

// the main function to run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Weather MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
