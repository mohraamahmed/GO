import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const err = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-debug-error": encodeURIComponent(msg),
    },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Attaches Enterprise Defense-in-Depth Security Headers to HTTP responses.
 */
function applySecurityHeaders(headers: Headers): Headers {
  const secureHeaders = new Headers(headers);
  secureHeaders.set("X-Content-Type-Options", "nosniff");
  secureHeaders.set("X-Frame-Options", "SAMEORIGIN");
  secureHeaders.set("X-XSS-Protection", "1; mode=block");
  secureHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secureHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  secureHeaders.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' blob: https: wss:; frame-ancestors 'self';"
  );
  return secureHeaders;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // 1. CSRF Origin Verification on state-changing requests
      if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
        const origin = request.headers.get("origin");
        const host = request.headers.get("host");
        if (origin && host) {
          try {
            const originHost = new URL(origin).host;
            // Allow exact host match, localhost in dev, or official vercel domain
            if (originHost !== host && !originHost.endsWith(".vercel.app") && !originHost.includes("localhost")) {
              return new Response(JSON.stringify({ error: "CSRF: Cross-origin request rejected" }), {
                status: 403,
                headers: { "content-type": "application/json" },
              });
            }
          } catch {
            return new Response(JSON.stringify({ error: "Invalid Origin header" }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }
        }
      }

      const handler = await getServerEntry();
      // Provide robust fallback for execution contexts missing waitUntil (e.g. edge runtimes or testing)
      const safeCtx =
        ctx && typeof ctx === "object" && typeof (ctx as Record<string, unknown>)["waitUntil"] === "function"
          ? ctx
          : { waitUntil: () => {}, ...(typeof ctx === "object" ? ctx : {}) };
      const response = await handler.fetch(request, env, safeCtx);
      const normalized = await normalizeCatastrophicSsrResponse(response);

      // 2. Attach hardened security headers
      const secureHeaders = applySecurityHeaders(normalized.headers);

      // 3. Attach Edge Caching on public SSR GET pages (Homepage, Listing, Details)
      try {
        const url = new URL(request.url);
        const isPublicGet =
          request.method === "GET" &&
          normalized.status === 200 &&
          !url.pathname.startsWith("/api") &&
          !url.pathname.startsWith("/admin") &&
          !url.pathname.startsWith("/auth") &&
          !url.pathname.startsWith("/_server") &&
          !request.headers.get("cookie")?.includes("cafelens-token");

        if (isPublicGet) {
          secureHeaders.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
        }
      } catch {
        // Safe fallback if URL parsing fails
      }

      return new Response(normalized.body, {
        status: normalized.status,
        statusText: normalized.statusText,
        headers: secureHeaders,
      });
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : String(error);
      const errorHeaders = applySecurityHeaders(new Headers({
        "content-type": "text/html; charset=utf-8",
        "x-debug-error": encodeURIComponent(errMsg),
      }));
      return new Response(renderErrorPage(), {
        status: 500,
        headers: errorHeaders,
      });
    }
  },
};
