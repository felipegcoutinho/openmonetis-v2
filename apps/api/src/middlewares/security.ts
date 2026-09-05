import { fail } from "@openmonetis/shared/api";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { ApiVariables } from "../types/context";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export const securityHeaders = createMiddleware(async (context, next) => {
  await next();

  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
  context.header("Referrer-Policy", "strict-origin-when-cross-origin");
  context.header("X-Permitted-Cross-Domain-Policies", "none");
  context.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (process.env.NODE_ENV === "production") {
    context.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

export const privateCache = createMiddleware(async (context, next) => {
  await next();
  context.header("Cache-Control", "private, no-store");
});

export function createMutationRateLimit(options: {
  windowMs: number;
  max: number;
  key: (context: Context<{ Variables: ApiVariables }>) => string | null;
  maxEntries?: number;
  onLimit?: (context: Context<{ Variables: ApiVariables }>, retryAfter: number) => Response;
}) {
  const entries = new Map<string, RateLimitEntry>();

  return createMiddleware<{ Variables: ApiVariables }>(async (context, next) => {
    if (!MUTATION_METHODS.has(context.req.method)) {
      await next();
      return;
    }

    const now = Date.now();
    const key = options.key(context);
    if (key === null) {
      await next();
      return;
    }

    const entry = entries.get(key);

    if (!entry || entry.resetAt <= now) {
      if (entries.size >= (options.maxEntries ?? 10_000)) {
        for (const [candidateKey, candidate] of entries) {
          if (candidate.resetAt <= now) entries.delete(candidateKey);
        }

        if (entries.size >= (options.maxEntries ?? 10_000)) {
          const oldestKey = entries.keys().next().value;
          if (oldestKey) entries.delete(oldestKey);
        }
      }
      entries.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    if (entry.count >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      context.header("Retry-After", String(retryAfter));
      if (options.onLimit) return options.onLimit(context, retryAfter);
      return context.json(fail("Too many requests", "rate_limited"), 429);
    }

    entry.count += 1;
    await next();
  });
}
