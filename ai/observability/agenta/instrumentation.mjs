//@ts-check
import { OpenAIInstrumentation } from '@arizeai/openinference-instrumentation-openai';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from 'dotenv';
import process from 'node:process';
import OpenAI from 'openai';

config();

// Get Agenta configuration from environment variables
const AGENTA_HOST = process.env.AGENTA_HOST || 'https://cloud.agenta.ai';
const AGENTA_API_KEY = process.env.AGENTA_API_KEY;

// Configure the OTLP exporter to send traces to Agenta
const otlpExporter = new OTLPTraceExporter({
  url: `${AGENTA_HOST}/api/otlp/v1/traces`,
  headers: {
    Authorization: `ApiKey ${AGENTA_API_KEY}`
  }
});

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'basic-service'
  }),
  spanProcessors: [
    new SimpleSpanProcessor(otlpExporter),
    new SimpleSpanProcessor(new ConsoleSpanExporter())
  ]
});
provider.register();

// Register OpenAI instrumentation
const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation]
});

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  otlpExporter
    .shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
