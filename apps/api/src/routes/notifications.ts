import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  NotificationParamsSchema,
  NotificationsOutputSchema,
  UpdateNotificationStateInputSchema,
} from "@openmonetis/validators/notifications";
import type { NotificationsService } from "../services/notifications.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";

export function createNotificationsRoute(service: NotificationsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Notifications"],
      responses: {
        200: {
          description: "Current actionable notifications",
          content: {
            "application/json": {
              schema: z.object({ data: NotificationsOutputSchema, error: z.null() }),
            },
          },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{notificationKey}",
      tags: ["Notifications"],
      request: {
        params: NotificationParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateNotificationStateInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Notification state updated",
          content: {
            "application/json": {
              schema: z.object({
                data: z.object({
                  notificationKey: z.string(),
                  isRead: z.boolean(),
                  isArchived: z.boolean(),
                }),
                error: z.null(),
              }),
            },
          },
        },
        400: {
          description: "Invalid notification state",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Notification not found",
          content: { "application/json": { schema: errorSchema } },
        },
        409: {
          description: "Notification changed",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (context) => {
      const result = await service.update(
        context.req.valid("param").notificationKey,
        context.req.valid("json"),
        context.get("userId"),
      );
      return context.json(ok(result), 200);
    },
  );

  return route;
}
