import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import type { AppConfig } from "../shared/config.js";

type GatewayDependencies = {
  fetcher?: typeof fetch;
};

export async function buildGateway(
  config: AppConfig,
  dependencies: GatewayDependencies = {},
): Promise<FastifyInstance> {
  const fetcher = dependencies.fetcher ?? fetch;
  const app = Fastify({ bodyLimit: 16 * 1024, logger: false });
  await app.register(rateLimit, { max: 6, timeWindow: "10 seconds" });

  app.get("/health", async () => ({ status: "healthy" }));
  app.all<{ Params: { "*": string } }>("/api/*", async (request, reply) => {
    if (request.headers.authorization !== `Bearer ${config.LOCAL_AUTH_TOKEN}`) {
      return reply
        .code(401)
        .send({ error: { code: "authentication_failed", retryable: false } });
    }

    const target = new URL(`/api/${request.params["*"]}`, config.BACKEND_URL);
    if (request.url.includes("?"))
      target.search = request.url.slice(request.url.indexOf("?"));
    const response = await fetcher(target, {
      method: request.method,
      headers: Object.fromEntries(
        Object.entries({
          authorization: request.headers.authorization,
          "content-type": request.headers["content-type"],
          traceparent: request.headers.traceparent,
          tracestate: request.headers.tracestate,
          "x-correlation-id": request.headers["x-correlation-id"],
        }).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      ...(request.method === "GET" || request.method === "HEAD"
        ? {}
        : { body: JSON.stringify(request.body) }),
    });
    const body = await response.text();
    reply
      .code(response.status)
      .header(
        "content-type",
        response.headers.get("content-type") ?? "application/json",
      );
    return reply.send(body);
  });

  return app;
}
