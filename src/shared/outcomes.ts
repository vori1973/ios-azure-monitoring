export const outcomeDefinitions = {
  authentication: {
    status: 401,
    code: "authentication_failed",
    retryable: false,
  },
  validation: { status: 400, code: "validation_failed", retryable: false },
  throttled: { status: 429, code: "rate_limited", retryable: true },
  configuration: {
    status: 503,
    code: "configuration_unavailable",
    retryable: false,
  },
  retryExhausted: {
    status: 503,
    code: "ingestion_retry_exhausted",
    retryable: true,
  },
  azureRejected: {
    status: 502,
    code: "azure_ingestion_rejected",
    retryable: false,
  },
} as const;

export type OutcomeKind = keyof typeof outcomeDefinitions;

export function errorBody(kind: OutcomeKind, details?: string) {
  const definition = outcomeDefinitions[kind];
  return {
    error: {
      code: definition.code,
      retryable: definition.retryable,
      ...(details ? { details } : {}),
    },
  };
}
