import { z } from "@hono/zod-openapi";
import {
  aiProviderLoginCodeMaximumLength,
  aiProviderLoginMethods,
  aiProviderLoginStatuses,
  aiProviderModelIdPattern,
  aiProviderModelNameMaximumLength,
  aiProviderStatuses,
  aiProviders,
} from "@openmonetis/domain/ai-providers";

export { aiProviders } from "@openmonetis/domain/ai-providers";

export const AiProviderSchema = z.enum(aiProviders);

/** A model id from the provider catalog; `null` means the default of the person's plan. */
export const AiProviderModelIdSchema = z.string().regex(aiProviderModelIdPattern);

export const AiProviderModelSchema = z
  .object({
    id: AiProviderModelIdSchema,
    name: z.string().min(1).max(aiProviderModelNameMaximumLength),
    isDefault: z.boolean(),
  })
  .openapi("AiProviderModel");

export const AiProviderParamsSchema = z
  .object({
    provider: AiProviderSchema.openapi({ param: { name: "provider", in: "path" } }),
  })
  .openapi("AiProviderParams");

export const AiProviderLoginParamsSchema = z
  .object({
    provider: AiProviderSchema.openapi({ param: { name: "provider", in: "path" } }),
    loginId: z.uuid().openapi({ param: { name: "loginId", in: "path" } }),
  })
  .openapi("AiProviderLoginParams");

/** Connecting requires explicit consent to send aggregated financial data to the provider. */
export const StartAiProviderLoginInputSchema = z
  .object({ acceptDataSharing: z.literal(true) })
  .strict()
  .openapi("StartAiProviderLoginInput");

export const UpdateAiProviderInputSchema = z
  .object({ preferredModel: AiProviderModelIdSchema.nullable() })
  .strict()
  .openapi("UpdateAiProviderInput");

export const SubmitAiProviderLoginCodeInputSchema = z
  .object({ code: z.string().trim().min(1).max(aiProviderLoginCodeMaximumLength) })
  .strict()
  .openapi("SubmitAiProviderLoginCodeInput");

export const AiProviderOutputSchema = z
  .object({
    provider: AiProviderSchema,
    status: z.enum(aiProviderStatuses),
    consentedAt: z.iso.datetime().nullable(),
    preferredModel: AiProviderModelIdSchema.nullable(),
    /** The vendor account signed in, when its CLI reports it; never stored by OpenMonetis. */
    accountEmail: z.email().nullable(),
    /** Models this account can use; empty while disconnected or when the catalog is unknown. */
    models: z.array(AiProviderModelSchema),
  })
  .openapi("AiProvider");

export const AiProvidersOutputSchema = z
  .object({
    enabled: z.boolean(),
    items: z.array(AiProviderOutputSchema),
  })
  .openapi("AiProviders");

export const AiProviderLoginOutputSchema = z
  .object({
    loginId: z.uuid(),
    provider: AiProviderSchema,
    method: z.enum(aiProviderLoginMethods),
    status: z.enum(aiProviderLoginStatuses),
    verificationUrl: z.url().nullable(),
    userCode: z.string().nullable(),
    expiresAt: z.iso.datetime(),
  })
  .openapi("AiProviderLogin");

export type AiProviderParams = z.infer<typeof AiProviderParamsSchema>;
export type AiProviderLoginParams = z.infer<typeof AiProviderLoginParamsSchema>;
export type StartAiProviderLoginInput = z.infer<typeof StartAiProviderLoginInputSchema>;
export type AiProviderModel = z.infer<typeof AiProviderModelSchema>;
export type UpdateAiProviderInput = z.infer<typeof UpdateAiProviderInputSchema>;
export type SubmitAiProviderLoginCodeInput = z.infer<typeof SubmitAiProviderLoginCodeInputSchema>;
export type AiProviderOutput = z.infer<typeof AiProviderOutputSchema>;
export type AiProvidersOutput = z.infer<typeof AiProvidersOutputSchema>;
export type AiProviderLoginOutput = z.infer<typeof AiProviderLoginOutputSchema>;
