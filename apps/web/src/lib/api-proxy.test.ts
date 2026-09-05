import assert from "node:assert/strict";
import test from "node:test";
import { proxyApiRequest, resolveUpstreamUrl } from "./api-proxy";

test("the API proxy keeps every path on the configured upstream origin", () => {
  const previous = process.env.API_INTERNAL_URL;
  process.env.API_INTERNAL_URL = "http://api.internal:7001/base";

  try {
    const target = resolveUpstreamUrl("http://attacker.invalid/private", "?key=value");
    assert.equal(target.origin, "http://api.internal:7001");
    assert.equal(target.pathname, "/http://attacker.invalid/private");
    assert.equal(target.search, "?key=value");
  } finally {
    if (previous === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = previous;
  }
});

test("the API proxy removes caller-controlled forwarding headers", async () => {
  const previousUrl = process.env.API_INTERNAL_URL;
  const previousFetch = globalThis.fetch;
  process.env.API_INTERNAL_URL = "http://api.internal:7001";

  let forwardedUrl = "";
  let forwardedHeaders = new Headers();
  globalThis.fetch = (async (input, init) => {
    forwardedUrl = String(input);
    forwardedHeaders = new Headers(init?.headers);
    return Response.json({ accepted: true });
  }) as typeof fetch;

  try {
    const response = await proxyApiRequest(
      new Request("https://web.example/api-proxy/api/inbox", {
        method: "POST",
        headers: {
          Authorization: "Bearer opm_secret",
          Cookie: "session=secret",
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.11",
          Forwarded: "for=attacker",
          "X-Forwarded-For": "203.0.113.10",
          "X-Forwarded-Client-Cert": "forged-certificate",
          "X-Forwarded-Host": "attacker.invalid",
          "X-Forwarded-Proto": "http",
          "X-Real-IP": "203.0.113.10",
        },
        body: JSON.stringify({ originalText: "Pagamento aprovado" }),
      }),
      "api/inbox",
    );

    assert.equal(response.status, 200);
    assert.equal(forwardedUrl, "http://api.internal:7001/api/inbox");
    assert.equal(forwardedHeaders.get("authorization"), "Bearer opm_secret");
    assert.equal(forwardedHeaders.get("cookie"), "session=secret");
    assert.equal(forwardedHeaders.get("cf-connecting-ip"), null);
    assert.equal(forwardedHeaders.get("forwarded"), null);
    assert.equal(forwardedHeaders.get("x-forwarded-for"), null);
    assert.equal(forwardedHeaders.get("x-forwarded-client-cert"), null);
    assert.equal(forwardedHeaders.get("x-real-ip"), null);
    assert.equal(forwardedHeaders.get("x-forwarded-host"), "web.example");
    assert.equal(forwardedHeaders.get("x-forwarded-proto"), "https");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = previousUrl;
  }
});

test("the API proxy rejects an oversized Companion payload before fetching upstream", async () => {
  const previousFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    return new Response();
  }) as typeof fetch;

  try {
    const response = await proxyApiRequest(
      new Request("https://web.example/api-proxy/api/inbox", {
        method: "POST",
        body: "x".repeat(16 * 1024 + 1),
      }),
      "api/inbox",
    );

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "Conteúdo muito grande" });
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("the API proxy stops the upstream request when the client disconnects", async () => {
  const previousUrl = process.env.API_INTERNAL_URL;
  const previousFetch = globalThis.fetch;
  const abortController = new AbortController();
  process.env.API_INTERNAL_URL = "http://api.internal:7001";

  let forwardedSignal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_input, init) => {
    forwardedSignal = init?.signal;
    abortController.abort(new Error("aborted"));
    throw abortController.signal.reason;
  }) as typeof fetch;

  try {
    const request = new Request("https://web.example/api-proxy/health", {
      signal: abortController.signal,
    });
    const response = await proxyApiRequest(request, "health");

    assert.equal(forwardedSignal, request.signal);
    assert.equal(response.status, 499);
    assert.equal(response.statusText, "Client Closed Request");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = previousUrl;
  }
});
