const STATIC_PATH_PREFIXES = ["/assets/", "/flags/", "/images/", "/logos/"];
const STATIC_PATHS = new Set([
  "/apple-touch-icon.png",
  "/favicon.svg",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/manifest.json",
  "/robots.txt",
]);

export function createContentSecurityPolicy(
  nonce: string,
  production: boolean,
  storageEndpoint?: string,
  storageBucket?: string,
  storageRegion?: string,
) {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  const connectSources = ["'self'"];
  const storageOrigin = getStorageOrigin(storageEndpoint, storageBucket, storageRegion);

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
    storageOrigin ? `frame-src ${storageOrigin}` : "frame-src 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
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
  storageBucket?: string;
  storageRegion?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Security-Policy": createContentSecurityPolicy(
      options.nonce,
      options.production,
      options.storageEndpoint,
      options.storageBucket,
      options.storageRegion,
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

function getStorageOrigin(
  endpoint: string | undefined,
  bucket: string | undefined,
  region: string | undefined,
) {
  if (!endpoint) return getAwsStorageOrigin(bucket, region);

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function getAwsStorageOrigin(bucket: string | undefined, region: string | undefined) {
  const normalizedBucket = bucket?.trim();
  const normalizedRegion = region?.trim() || "us-east-1";
  if (!normalizedBucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(normalizedBucket)) {
    return null;
  }
  if (!/^[a-z0-9-]+$/.test(normalizedRegion)) return null;

  return `https://${normalizedBucket}.s3.${normalizedRegion}.amazonaws.com`;
}

function isStaticPath(pathname: string) {
  return (
    STATIC_PATHS.has(pathname) || STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
