import { type Hook, z } from "@hono/zod-openapi";
import { fail } from "@openmonetis/shared/api";
import type { ApiVariables } from "../types/context";

export const ErrorResponseSchema = z.object({
  error: z.literal(true),
  message: z.string(),
  code: z.string().optional(),
});

export function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: ErrorResponseSchema } },
  } as const;
}

export const validationHook: Hook<unknown, { Variables: ApiVariables }, string, unknown> = (
  result,
  context,
) => {
  if (result.success) {
    return;
  }

  return context.json(fail("Revise os campos enviados.", "validation_error"), 400);
};

export const companionValidationHook: Hook<
  unknown,
  { Variables: ApiVariables },
  string,
  unknown
> = (result, context) => {
  if (result.success) return;
  return context.json({ error: "Revise os dados enviados" }, 400);
};
