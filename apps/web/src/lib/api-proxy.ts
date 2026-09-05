const defaultApiInternalUrl = "http://localhost:7001";
const defaultMaximumBodySize = 8 * 1024 * 1024;
const companionInboxMaximumBodySize = 16 * 1024;
const companionInboxBatchMaximumBodySize = 256 * 1024;

class ProxyBodyTooLargeError extends Error {}

export async function proxyApiRequest(request: Request, upstreamPath: string) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = resolveUpstreamUrl(upstreamPath, incomingUrl.search);
  const headers = createUpstreamHeaders(request.headers);
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.slice(0, -1));

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    return await fetch(upstreamUrl, {
      body: hasBody
        ? await readRequestBody(request, getMaximumBodySize(upstreamUrl.pathname))
        : undefined,
      headers,
      method: request.method,
      redirect: "manual",
      signal: request.signal,
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499, statusText: "Client Closed Request" });
    }
    if (!(error instanceof ProxyBodyTooLargeError)) throw error;

    const companionCompatibilityRoute = upstreamUrl.pathname.startsWith("/api/");
    return Response.json(
      companionCompatibilityRoute
        ? { error: "Conteúdo muito grande" }
        : {
            error: true,
            message: "Request body is too large",
            code: "payload_too_large",
          },
      { status: 413 },
    );
  }
}

export function resolveUpstreamUrl(pathname: string, search: string) {
  const configuredUrl = process.env.API_INTERNAL_URL?.trim() || defaultApiInternalUrl;
  const baseUrl = new URL(configuredUrl);

  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("API_INTERNAL_URL must use HTTP or HTTPS");
  }

  baseUrl.pathname = "/";
  baseUrl.search = "";
  baseUrl.hash = "";

  const upstreamUrl = new URL(baseUrl);
  upstreamUrl.pathname = `/${pathname.replace(/^\/+/, "")}`;
  upstreamUrl.search = search;

  if (upstreamUrl.origin !== baseUrl.origin) {
    throw new Error("API proxy target must stay on API_INTERNAL_URL");
  }

  return upstreamUrl;
}

function createUpstreamHeaders(source: Headers) {
  const headers = new Headers(source);
  for (const name of [
    "cf-connecting-ip",
    "connection",
    "content-length",
    "forwarded",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "via",
    "x-real-ip",
  ]) {
    headers.delete(name);
  }
  for (const name of [...headers.keys()]) {
    if (name.startsWith("x-forwarded-") || name.startsWith("proxy-")) headers.delete(name);
  }
  return headers;
}

function getMaximumBodySize(pathname: string) {
  if (pathname === "/api/inbox") return companionInboxMaximumBodySize;
  if (pathname === "/api/inbox/batch") return companionInboxBatchMaximumBodySize;
  const configured = Number(process.env.API_PROXY_MAX_BODY_BYTES);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : defaultMaximumBodySize;
}

async function readRequestBody(request: Request, maximumSize: number) {
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maximumSize) {
    throw new ProxyBodyTooLargeError();
  }

  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalSize += value.byteLength;
    if (totalSize > maximumSize) {
      await reader.cancel();
      throw new ProxyBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}
