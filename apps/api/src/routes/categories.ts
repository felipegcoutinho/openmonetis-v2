import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CategoryOutputSchema,
  CategoryParamsSchema,
  CreateCategoryInputSchema,
  ReplaceCategoryInputSchema,
  UpdateCategoryInputSchema,
} from "@openmonetis/validators/categories";
import type { CategoriesService } from "../services/categories.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

const OneSchema = z.object({ data: CategoryOutputSchema, error: z.null() });
const ManySchema = z.object({ data: z.array(CategoryOutputSchema), error: z.null() });
const DeletedSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });

export function createCategoriesRoute(service: CategoriesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Categories"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateCategoryInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created category",
          content: { "application/json": { schema: OneSchema } },
        },
        400: error("Invalid request"),
        401: error("Authentication required"),
      },
    }),
    async (c) => c.json(ok(await service.create(c.req.valid("json"), c.get("userId"))), 201),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Categories"],
      responses: {
        200: {
          description: "List categories",
          content: { "application/json": { schema: ManySchema } },
        },
        401: error("Authentication required"),
      },
    }),
    async (c) => c.json(ok(await service.list(c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Categories"],
      request: { params: CategoryParamsSchema },
      responses: {
        200: {
          description: "Get category",
          content: { "application/json": { schema: OneSchema } },
        },
        401: error("Authentication required"),
        404: error("Category not found"),
      },
    }),
    async (c) => c.json(ok(await service.get(c.req.valid("param").id, c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "put",
      path: "/{id}",
      tags: ["Categories"],
      request: {
        params: CategoryParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ReplaceCategoryInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Replaced category",
          content: { "application/json": { schema: OneSchema } },
        },
        400: error("Invalid request"),
        401: error("Authentication required"),
        404: error("Category not found"),
      },
    }),
    async (c) =>
      c.json(
        ok(await service.replace(c.req.valid("param").id, c.get("userId"), c.req.valid("json"))),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Categories"],
      request: {
        params: CategoryParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateCategoryInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated category",
          content: { "application/json": { schema: OneSchema } },
        },
        400: error("Invalid request"),
        401: error("Authentication required"),
        404: error("Category not found"),
      },
    }),
    async (c) =>
      c.json(
        ok(await service.update(c.req.valid("param").id, c.get("userId"), c.req.valid("json"))),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Categories"],
      request: { params: CategoryParamsSchema },
      responses: {
        200: {
          description: "Deleted category",
          content: { "application/json": { schema: DeletedSchema } },
        },
        401: error("Authentication required"),
        404: error("Category not found"),
      },
    }),
    async (c) => c.json(ok(await service.remove(c.req.valid("param").id, c.get("userId"))), 200),
  );
  return route;
}
