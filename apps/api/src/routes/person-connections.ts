import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  ClaimedPersonConnectionInvitationOutputSchema,
  ClaimPersonConnectionInvitationInputSchema,
  ConfirmPersonConnectionInputSchema,
  CreatedPersonConnectionInvitationOutputSchema,
  CreatePersonConnectionInvitationInputSchema,
  PersonConnectionInvitationOutputSchema,
  PersonConnectionOutputSchema,
  PersonConnectionParamsSchema,
} from "@openmonetis/validators/person-connections";
import type { PersonConnectionsService } from "../services/person-connections.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

const errors = {
  400: error("Invalid request"),
  401: error("Authentication required"),
  404: error("Connection not found"),
  409: error("Connection state conflict"),
} as const;

export function createPersonConnectionsRoute(service: PersonConnectionsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "post",
      path: "/invitations",
      tags: ["Person connections"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreatePersonConnectionInvitationInputSchema } },
        },
      },
      responses: {
        201: {
          description: "One-time invitation created",
          content: {
            "application/json": {
              schema: z.object({
                data: CreatedPersonConnectionInvitationOutputSchema,
                error: z.null(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.createInvitation(context.req.valid("json").personId, context.get("userId")),
        ),
        201,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/invitations",
      tags: ["Person connections"],
      responses: {
        200: {
          description: "Invitations owned by the authenticated user",
          content: {
            "application/json": {
              schema: z.object({
                data: z.array(PersonConnectionInvitationOutputSchema),
                error: z.null(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) => context.json(ok(await service.listInvitations(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/invitations/claim",
      tags: ["Person connections"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: ClaimPersonConnectionInvitationInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Invitation claimed and confirmation code issued",
          content: {
            "application/json": {
              schema: z.object({
                data: ClaimedPersonConnectionInvitationOutputSchema,
                error: z.null(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.claimInvitation(context.req.valid("json").token, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/invitations/{id}/confirm",
      tags: ["Person connections"],
      request: {
        params: PersonConnectionParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ConfirmPersonConnectionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Bilateral connection activated",
          content: {
            "application/json": {
              schema: z.object({ data: PersonConnectionOutputSchema, error: z.null() }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.confirmInvitation(
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
      method: "post",
      path: "/invitations/{id}/cancel",
      tags: ["Person connections"],
      request: { params: PersonConnectionParamsSchema },
      responses: {
        200: {
          description: "Invitation cancelled",
          content: {
            "application/json": {
              schema: z.object({ data: PersonConnectionInvitationOutputSchema, error: z.null() }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.cancelInvitation(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Person connections"],
      responses: {
        200: {
          description: "Connections visible to the authenticated user",
          content: {
            "application/json": {
              schema: z.object({ data: z.array(PersonConnectionOutputSchema), error: z.null() }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) => context.json(ok(await service.listConnections(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Person connections"],
      request: { params: PersonConnectionParamsSchema },
      responses: {
        200: {
          description: "Connection revoked",
          content: {
            "application/json": {
              schema: z.object({ data: PersonConnectionOutputSchema, error: z.null() }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.revokeConnection(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  return route;
}
