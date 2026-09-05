import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreateInboxRuleInputSchema,
  DeleteInboxRuleQuerySchema,
  InboxRuleOutputSchema,
  InboxRuleParamsSchema,
  InboxRuleSuggestionOutputSchema,
  InboxRuleSuggestionParamsSchema,
  InboxRulesListOutputSchema,
  ReplaceInboxRuleInputSchema,
  SetInboxRuleActiveInputSchema,
} from "@openmonetis/validators/inbox-rules";
import type { InboxRulesService } from "../services/inbox-rules.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

const RuleResponseSchema = z.object({ data: InboxRuleOutputSchema, error: z.null() });
const ListResponseSchema = z.object({ data: InboxRulesListOutputSchema, error: z.null() });
const SuggestionResponseSchema = z.object({
  data: InboxRuleSuggestionOutputSchema,
  error: z.null(),
});
const DeletedResponseSchema = z.object({
  data: z.object({ id: z.uuid() }),
  error: z.null(),
});

const errors = {
  400: error("Invalid request"),
  401: error("Authentication required"),
  404: error("Inbox rule or item not found"),
  409: error("Inbox rule conflict"),
  429: error("Too many requests"),
} as const;

export function createInboxRulesRoute(service: InboxRulesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Inbox rules"],
      responses: {
        200: {
          description: "List inbox rules ordered by priority",
          content: { "application/json": { schema: ListResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Inbox rules"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateInboxRuleInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created inbox rule",
          content: { "application/json": { schema: RuleResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/suggestions/{inboxItemId}",
      tags: ["Inbox rules"],
      request: { params: InboxRuleSuggestionParamsSchema },
      responses: {
        200: {
          description: "Resolve rule-based defaults for a pending inbox item",
          content: { "application/json": { schema: SuggestionResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.resolveSuggestion(
            context.req.valid("param").inboxItemId,
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "put",
      path: "/{id}",
      tags: ["Inbox rules"],
      request: {
        params: InboxRuleParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ReplaceInboxRuleInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Replaced inbox rule",
          content: { "application/json": { schema: RuleResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.replace(
            context.req.valid("param").id,
            context.req.valid("json"),
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}/active",
      tags: ["Inbox rules"],
      request: {
        params: InboxRuleParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: SetInboxRuleActiveInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Changed inbox rule activation",
          content: { "application/json": { schema: RuleResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.setActive(
            context.req.valid("param").id,
            context.req.valid("json"),
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Inbox rules"],
      request: { params: InboxRuleParamsSchema, query: DeleteInboxRuleQuerySchema },
      responses: {
        200: {
          description: "Deleted inbox rule",
          content: { "application/json": { schema: DeletedResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.remove(
            context.req.valid("param").id,
            context.req.valid("query").expectedVersion,
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  return route;
}
