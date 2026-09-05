import { fail } from "@openmonetis/shared/api";
import { createMiddleware } from "hono/factory";
import type { ApiVariables } from "../types/context";
import { getSession } from "../utils/session";

export const requireAuth = createMiddleware<{ Variables: ApiVariables }>(async (context, next) => {
  const session = await getSession(context.req.raw.headers);

  if (!session) {
    return context.json(fail("Authentication required", "unauthorized"), 401);
  }

  context.set("userId", session.user.id);
  await next();
});
