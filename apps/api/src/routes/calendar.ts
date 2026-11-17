import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import { CalendarOutputSchema, CalendarQuerySchema } from "@openmonetis/validators/calendar";
import type { CalendarService } from "../services/calendar.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

export function createCalendarRoute(service: CalendarService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Calendar"],
      request: { query: CalendarQuerySchema },
      responses: {
        200: {
          description:
            "Bills, card invoice closing and due dates, and tasks of the month, grouped by day",
          content: {
            "application/json": {
              schema: z.object({ data: CalendarOutputSchema, error: z.null() }),
            },
          },
        },
        400: error("Invalid period"),
        401: error("Authentication required"),
      },
    }),
    async (context) =>
      context.json(
        ok(await service.get(context.req.valid("query").period, context.get("userId"))),
        200,
      ),
  );
  return route;
}
