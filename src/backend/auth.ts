import type { IncomingHttpHeaders } from "node:http";

export class AuthenticationError extends Error {}

export type AuthenticatedClient = {
  clientId: string;
};

export interface AuthVerifier {
  verify(headers: IncomingHttpHeaders): AuthenticatedClient;
}

export class LocalTokenVerifier implements AuthVerifier {
  public constructor(private readonly expectedToken: string) {}

  public verify(headers: IncomingHttpHeaders): AuthenticatedClient {
    if (headers.authorization !== `Bearer ${this.expectedToken}`) {
      throw new AuthenticationError("Invalid local client identity");
    }
    return { clientId: "local-mobile-simulator" };
  }
}

export class ApimTrustVerifier implements AuthVerifier {
  public constructor(
    private readonly headerName: string,
    private readonly expectedValue: string,
  ) {}

  public verify(headers: IncomingHttpHeaders): AuthenticatedClient {
    const value = headers[this.headerName.toLowerCase()];
    const clientId = headers["x-client-id"];
    if (
      value !== this.expectedValue ||
      typeof clientId !== "string" ||
      clientId.length < 3
    ) {
      throw new AuthenticationError("APIM trust contract was not satisfied");
    }
    return { clientId };
  }
}
