import { describe, expect, it } from "vitest";

import {
  ApimTrustVerifier,
  AuthenticationError,
  LocalTokenVerifier,
} from "../../src/backend/auth.js";

describe("authentication trust boundaries", () => {
  it("validates the local bearer token", () => {
    const verifier = new LocalTokenVerifier("local-demo-token-value");
    expect(
      verifier.verify({ authorization: "Bearer local-demo-token-value" }),
    ).toEqual({ clientId: "local-mobile-simulator" });
    expect(() => verifier.verify({})).toThrow(AuthenticationError);
  });

  it("requires APIM trust and an asserted client identity", () => {
    const verifier = new ApimTrustVerifier(
      "x-apim-authenticated",
      "gateway-managed-value",
    );
    expect(
      verifier.verify({
        "x-apim-authenticated": "gateway-managed-value",
        "x-client-id": "mobile-client",
      }),
    ).toEqual({ clientId: "mobile-client" });
    expect(() =>
      verifier.verify({
        "x-apim-authenticated": "wrong",
        "x-client-id": "mobile-client",
      }),
    ).toThrow(AuthenticationError);
  });
});
