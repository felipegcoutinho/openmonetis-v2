import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreatedGoalContributionOutputSchema,
  CreateGoalContributionInputSchema,
  CreateGoalInputSchema,
  GoalContributionParamsSchema,
  GoalContributionsOutputSchema,
  GoalOutputSchema,
  GoalParamsSchema,
  RemovedGoalContributionOutputSchema,
  UpdateGoalInputSchema,
} from "@openmonetis/validators/goals";
import type { GoalsService } from "../services/goals.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const GoalResponseSchema = z.object({ data: GoalOutputSchema, error: z.null() });
const GoalsResponseSchema = z.object({ data: z.array(GoalOutputSchema), error: z.null() });
const DeleteResponseSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });
const ContributionsResponseSchema = z.object({
  data: GoalContributionsOutputSchema,
  error: z.null(),
});
const CreatedContributionResponseSchema = z.object({
  data: CreatedGoalContributionOutputSchema,
  error: z.null(),
});
const RemovedContributionResponseSchema = z.object({
  data: RemovedGoalContributionOutputSchema,
  error: z.null(),
});

export function createGoalsRoute(service: GoalsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Goals"],
      responses: {
        200: {
          description: "Goals for the authenticated user",
          content: { "application/json": { schema: GoalsResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Goals"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateGoalInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created goal",
          content: { "application/json": { schema: GoalResponseSchema } },
        },
        400: {
          description: "Invalid goal",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Linked account not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Goals"],
      request: { params: GoalParamsSchema },
      responses: {
        200: {
          description: "Get goal",
          content: { "application/json": { schema: GoalResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Goal not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.get(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Goals"],
      request: {
        params: GoalParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateGoalInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated goal",
          content: { "application/json": { schema: GoalResponseSchema } },
        },
        400: {
          description: "Invalid goal update",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Goal not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.update(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("json"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Goals"],
      request: { params: GoalParamsSchema },
      responses: {
        200: {
          description: "Deleted goal",
          content: { "application/json": { schema: DeleteResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Goal not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.remove(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}/contributions",
      tags: ["Goals"],
      request: { params: GoalParamsSchema },
      responses: {
        200: {
          description: "Contributions of the goal, newest first, with the monthly balance history",
          content: { "application/json": { schema: ContributionsResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Goal not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.listContributions(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{id}/contributions",
      tags: ["Goals"],
      request: {
        params: GoalParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: CreateGoalContributionInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Recorded contribution and the updated goal",
          content: { "application/json": { schema: CreatedContributionResponseSchema } },
        },
        400: {
          description: "Invalid contribution",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Goal not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.addContribution(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("json"),
          ),
        ),
        201,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}/contributions/{contributionId}",
      tags: ["Goals"],
      request: { params: GoalContributionParamsSchema },
      responses: {
        200: {
          description: "Removed contribution; the goal balance is reverted",
          content: { "application/json": { schema: RemovedContributionResponseSchema } },
        },
        400: {
          description: "Contribution cannot be removed",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Goal or contribution not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id, contributionId } = context.req.valid("param");
      return context.json(
        ok(await service.removeContribution(id, contributionId, context.get("userId"))),
        200,
      );
    },
  );
  return route;
}
