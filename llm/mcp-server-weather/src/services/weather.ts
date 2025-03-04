import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BaseService } from './base';

export const NWS_API_BASE = 'https://api.weather.gov';
export const USER_AGENT = 'weather-app/1.0';

export interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

export interface AlertsResponse {
  features: AlertFeature[];
}
export interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

export interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

export interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}
export class WeatherService implements BaseService {
  constructor() {
  }

  register(s: McpServer) {
    s.tool(
      'get-alerts',
      {
        state: z
          .string()
          .length(2)
          .describe('Two letter state code (e.g. CA, NY)'),
      },
      async ({ state }) => {
        const alerts = await this.getAlertsForState(state);
        return {
          content: [
            {
              type: 'text',
              text: alerts,
            },
          ],
        };
      }
    );

    s.tool(
      'get-forecast',
      {
        latitude: z
          .number()
          .min(-90)
          .max(90)
          .describe('Latitude of the location'),
        longitude: z
          .number()
          .min(-180)
          .max(180)
          .describe('Longitude of the location'),
      },
      async ({ latitude, longitude }) => {
        const forecast = await this.getForecastForLocation(
          latitude,
          longitude
        );
        return {
          content: [
            {
              type: 'text',
              text: forecast,
            },
          ],
        };
      }
    );
  }

  async getAlertsForState(stateCode: string): Promise<string> {
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await this.makeNWSRequest<AlertsResponse>(alertsUrl);
    if (!alertsData) {
      return 'Failed to retrieve alerts data';
    }
    const { features = [] } = alertsData;
    if (features.length === 0) {
      return 'No active alerts for' + stateCode;
    }
    const formattedAlerts = features.map(this.formatAlerts);
    return formattedAlerts.join('\n');
  }

  async getForecastForLocation(
    latitude: number,
    longitude: number
  ): Promise<string> {
    const pointsUrl = `${NWS_API_BASE}/points/${latitude},${longitude}`;
    const pointsData = await this.makeNWSRequest<PointsResponse>(pointsUrl);
    if (!pointsData) {
      return `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`;
    }
    const { forecast: forecastUrl } = pointsData.properties || {};
    if (!forecastUrl) {
      return 'Failed to get forecast URL from grid point data';
    }
    const forecastData = await this.makeNWSRequest<ForecastResponse>(
      forecastUrl
    );
    if (!forecastData) {
      return 'Failed to retrieve forecast data';
    }
    const { periods = [] } = forecastData.properties || {};
    const formattedForecast = periods.map(this.formatForecast).join('\n');

    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast}`;
    return forecastText;
  }

  private async makeNWSRequest<T>(url: string): Promise<T | null> {
    const headers = {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    };
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json() as T;
    } catch (error) {
      console.error(`Error fetching data: ${error}`);
      return null;
    }
  }

  private formatAlerts(feature: AlertFeature): string {
    const { properties } = feature;
    const {
      event = 'Unknown',
      areaDesc = 'Unknown',
      severity = 'Unknown',
      status = 'Unknown',
      headline = 'No headline',
    } = properties || {};
    return [
      `Event: ${event}`,
      `Area: ${areaDesc}`,
      `Severity: ${severity}`,
      `Status: ${status}`,
      `Headline: ${headline}`,
      '---',
    ].join('\n');
  }
  private formatForecast(period: ForecastPeriod): string {
    return [
      `${period.name || 'Unknown'}:`,
      `Temperature: ${period.temperature || 'Unknown'}°${
        period.temperatureUnit || 'F'
      }`,
      `Wind: ${period.windSpeed || 'Unknown'} ${period.windDirection || ''}`,
      `${period.shortForecast || 'No forecast available'}`,
      '---',
    ].join('\n');
  }
}
