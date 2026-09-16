const forbiddenKeyPattern =
  /(authorization|cookie|password|secret|token|credential|email|phone|name|address|patient|diagnosis|ssn)/i;
const forbiddenValuePatterns = [
  /\bBearer\s+[A-Za-z0-9._~-]+/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /\b[A-Za-z0-9+/]{32,}={0,2}\b/,
];

export type SensitiveFinding = {
  path: string;
  reason: "forbidden-key" | "credential-like-value";
};

export function findSensitiveData(
  value: unknown,
  path = "$",
): SensitiveFinding[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findSensitiveData(item, `${path}[${index}]`),
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => {
      const childPath = `${path}.${key}`;
      if (forbiddenKeyPattern.test(key)) {
        return [{ path: childPath, reason: "forbidden-key" as const }];
      }
      return findSensitiveData(child, childPath);
    });
  }
  if (
    typeof value === "string" &&
    forbiddenValuePatterns.some((pattern) => pattern.test(value))
  ) {
    return [{ path, reason: "credential-like-value" }];
  }
  return [];
}

const allowedTelemetryKeys = new Set([
  "event.type",
  "event.schema_version",
  "event.outcome",
  "event.duration_ms",
  "correlation.id",
  "error.code",
  "http.request.method",
  "http.response.status_code",
  "dependency.mode",
]);

export function sanitizeTelemetryAttributes(
  attributes: Record<string, unknown>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, string | number | boolean] =>
        allowedTelemetryKeys.has(entry[0]) &&
        ["string", "number", "boolean"].includes(typeof entry[1]),
    ),
  );
}
