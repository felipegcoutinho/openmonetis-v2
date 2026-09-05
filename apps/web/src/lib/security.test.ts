import assert from "node:assert/strict";
import test from "node:test";
import { createContentSecurityPolicy, createWebSecurityHeaders } from "./security";

test("production CSP authorizes only nonce-bearing application scripts", () => {
  const policy = createContentSecurityPolicy("test-nonce", true);

  assert.match(policy, /script-src 'self' 'nonce-test-nonce' 'strict-dynamic'/);
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /upgrade-insecure-requests/);
  assert.doesNotMatch(policy, /'unsafe-eval'/);
});

test("CSP allows only the configured attachment storage origin", () => {
  const policy = createContentSecurityPolicy(
    "test-nonce",
    true,
    "https://project.storage.example.com/storage/v1/s3?ignored=true",
  );

  assert.match(policy, /connect-src 'self' https:\/\/project\.storage\.example\.com/);
  assert.doesNotMatch(policy, /storage\/v1\/s3/);
  assert.doesNotMatch(policy, /ignored/);
});

test("CSP ignores an invalid attachment storage endpoint", () => {
  const policy = createContentSecurityPolicy(
    "test-nonce",
    true,
    "javascript:alert('not a source')",
  );

  assert.match(policy, /connect-src 'self';/);
  assert.doesNotMatch(policy, /javascript:/);
});

test("dynamic production responses receive defense-in-depth and private cache headers", () => {
  const headers = createWebSecurityHeaders({
    nonce: "test-nonce",
    pathname: "/accounts",
    production: true,
  });

  assert.equal(headers["Cache-Control"], "private, no-store");
  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
});

test("versioned static assets remain cacheable", () => {
  const headers = createWebSecurityHeaders({
    nonce: "test-nonce",
    pathname: "/assets/application.js",
    production: true,
  });

  assert.equal(headers["Cache-Control"], undefined);
});
