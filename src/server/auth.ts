import { appConfig } from "./config";

export function accessDeniedResponse(): Response {
  return Response.json({ error: "Private access token required." }, { status: 401 });
}

export function hasPrivateAccess(request: Request): boolean {
  if (!appConfig.accessToken) return true;
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : request.headers.get("x-access-token");
  return supplied === appConfig.accessToken;
}

export function requirePrivateAccess(request: Request): Response | null {
  return hasPrivateAccess(request) ? null : accessDeniedResponse();
}

