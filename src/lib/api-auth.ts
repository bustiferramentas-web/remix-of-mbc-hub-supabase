// Shared helpers for /api/* integration endpoints.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Access-Control-Max-Age": "86400",
} as const;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export function checkApiKey(request: Request): Response | null {
  const expected = process.env.INTEGRATION_API_KEY;
  if (!expected) {
    return jsonResponse({ error: "Server misconfigured: missing INTEGRATION_API_KEY" }, 500);
  }
  const provided = request.headers.get("x-api-key");
  if (!provided || provided !== expected) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  return null;
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
