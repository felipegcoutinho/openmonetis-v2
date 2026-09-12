import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { createWebSecurityHeaders } from "./lib/security";

const webSecurityMiddleware = createMiddleware().server(async ({ next, request }) => {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const pathname = new URL(request.url).pathname;

  const securityHeaders = createWebSecurityHeaders({
    nonce,
    pathname,
    production: process.env.NODE_ENV === "production",
    storageBucket: process.env.S3_BUCKET,
    storageEndpoint: process.env.S3_ENDPOINT,
    storageRegion: process.env.S3_REGION,
  });
  const result = await next({ context: { nonce } });
  const headers = new Headers(result.response.headers);

  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value);
  }

  return {
    ...result,
    response: new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers,
    }),
  };
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [webSecurityMiddleware, csrfMiddleware],
}));
