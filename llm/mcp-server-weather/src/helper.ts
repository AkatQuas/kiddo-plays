export const NWS_API_BASE = 'https://api.weather.gov';
export const USER_AGENT = 'weather-app/1.0';

// helper function for making NWS API requests
export async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/geo+json',
  };
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error fetching data: ${error}`);
    return null;
  }
}

export interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// Format alert data
export const formatAlerts = (feature: AlertFeature): string => {
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
};

export interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

export interface AlertsResponse {
  features: AlertFeature[];
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

export const formatForecast = (period: ForecastPeriod): string => {
  return [
    `${period.name || 'Unknown'}:`,
    `Temperature: ${period.temperature || 'Unknown'}°${
      period.temperatureUnit || 'F'
    }`,
    `Wind: ${period.windSpeed || 'Unknown'} ${period.windDirection || ''}`,
    `${period.shortForecast || 'No forecast available'}`,
    '---',
  ].join('\n');
};
