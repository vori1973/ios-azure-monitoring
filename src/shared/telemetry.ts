import { diag, DiagLogLevel, trace, type Tracer } from "@opentelemetry/api";
import {
  ExportResultCode,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export type Telemetry = {
  tracer: Tracer;
  shutdown: () => Promise<void>;
  exportErrorCount: () => number;
};

export function createTelemetry(
  serviceName: string,
  endpoint: string,
  serviceVersion = "0.1.0",
  headerText = "",
): Telemetry {
  let errors = 0;
  diag.setLogger(
    {
      error: () => {
        errors += 1;
      },
      warn: () => undefined,
      info: () => undefined,
      debug: () => undefined,
      verbose: () => undefined,
    },
    DiagLogLevel.ERROR,
  );

  const otlpExporter = new OTLPTraceExporter({
    url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
    headers: Object.fromEntries(
      headerText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const separator = entry.indexOf("=");
          if (separator < 1)
            throw new Error("Invalid OTLP header configuration");
          return [entry.slice(0, separator), entry.slice(separator + 1)];
        }),
    ),
  });
  const exporter: SpanExporter = {
    export: (spans: ReadableSpan[], resultCallback) => {
      otlpExporter.export(spans, (result) => {
        if (result.code !== ExportResultCode.SUCCESS) errors += 1;
        resultCallback(result);
      });
    },
    shutdown: () => otlpExporter.shutdown(),
    forceFlush: () => otlpExporter.forceFlush(),
  };
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    spanProcessors: [
      new BatchSpanProcessor(exporter, {
        maxQueueSize: 256,
        maxExportBatchSize: 64,
        scheduledDelayMillis: 500,
        exportTimeoutMillis: 5_000,
      }),
    ],
  });
  provider.register({ propagator: new W3CTraceContextPropagator() });

  return {
    tracer: trace.getTracer(serviceName, serviceVersion),
    shutdown: async () => {
      try {
        await provider.forceFlush();
        await provider.shutdown();
      } catch (error) {
        errors += 1;
        throw error;
      }
    },
    exportErrorCount: () => errors,
  };
}
