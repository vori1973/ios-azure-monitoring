import { loadConfig } from "../shared/config.js";
import { buildGateway } from "./app.js";

const config = loadConfig();
const app = await buildGateway(config);
await app.listen({ host: config.GATEWAY_HOST, port: config.GATEWAY_PORT });
console.log(
  JSON.stringify({
    service: "gateway",
    mode: config.POC_MODE,
    status: "listening",
  }),
);
