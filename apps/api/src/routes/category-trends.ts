import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CategoryTrendsOutputSchema,
  ListCategoryTrendsQuerySchema,
} from "@openmonetis/validators/category-trends";
import type { CategoryTrendsService } from "../services/category-trends.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const CategoryTrendsResponseSchema = z.object({
  data: CategoryTrendsOutputSchema,
  error: z.null(),
});

export function createCategoryTrendsRoute(service: CategoryTrendsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Reports"],
      request: { query: ListCategoryTrendsQuerySchema },
      responses: {
        200: {
          description: "Category trends over a monthly period range",
          content: { "application/json": { schema: CategoryTrendsResponseSchema } },
        },
        400: {
          description: "Invalid report period or category filter",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(ok(await service.list(context.get("userId"), context.req.valid("query"))), 200),
  );

  return route;
}
