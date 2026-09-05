const STATIC_PATH_PREFIXES = ["/assets/", "/flags/", "/images/", "/logos/"];
const STATIC_PATHS = new Set([
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/manifest.json",
  "/robots.txt",
]);

export function createContentSecurityPolicy(
  nonce: string,
  production: boolean,
  storageEndpoint?: string,
) {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  const connectSources = ["'self'"];
  const storageOrigin = getStorageOrigin(storageEndpoint);

  if (storageOrigin) connectSources.push(storageOrigin);

  if (!production) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("ws:", "wss:");
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "manifest-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
  ];

  if (production) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}

export function createWebSecurityHeaders(options: {
  nonce: string;
  pathname: string;
  production: boolean;
  storageEndpoint?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Security-Policy": createContentSecurityPolicy(
      options.nonce,
      options.production,
      options.storageEndpoint,
    ),
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
  };

  if (options.production) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  if (!isStaticPath(options.pathname)) {
    headers["Cache-Control"] = "private, no-store";
  }

  return headers;
}

function getStorageOrigin(endpoint: string | undefined) {
  if (!endpoint) return null;

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function isStaticPath(pathname: string) {
  return (
    STATIC_PATHS.has(pathname) || STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
