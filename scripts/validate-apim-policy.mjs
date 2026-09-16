import { readFile } from "node:fs/promises";

const policy = await readFile("config/apim/policy.xml", "utf8");
for (const required of [
  "<validate-jwt",
  "<rate-limit-by-key",
  "<check-header",
  '<set-header name="traceparent"',
  "<set-backend-service",
]) {
  if (!policy.includes(required))
    throw new Error(`APIM policy is missing ${required}`);
}
if (
  /Authorization|request\.body/i.test(
    policy.match(/<trace[\s\S]*?<\/trace>/g)?.join("") ?? "",
  )
) {
  throw new Error(
    "APIM trace policy may expose authorization or request bodies",
  );
}
console.log("APIM policy controls verified");
