import { z } from "@hono/zod-openapi";
import {
  aiToolEventActions,
  aiToolEventStatuses,
  aiToolFailureCodes,
  aiToolInstallSteps,
  aiToolVersionPattern,
} from "@openmonetis/domain/ai-tools";
import { AiProviderSchema } from "./ai-providers";

export const AiToolVersionSchema = z.string().regex(aiToolVersionPattern);

export const AiToolParamsSchema = z
  .object({
    provider: AiProviderSchema.openapi({ param: { name: "provider", in: "path" } }),
  })
  .openapi("AiToolParams");

export const AiToolJobParamsSchema = z
  .object({
    provider: AiProviderSchema.openapi({ param: { name: "provider", in: "path" } }),
    jobId: z.uuid().openapi({ param: { name: "jobId", in: "path" } }),
  })
  .openapi("AiToolJobParams");

/** `canary` also runs a short diagnosis with the admin's own sign-in before activating. */
export const InstallAiToolInputSchema = z
  .object({ version: AiToolVersionSchema, canary: z.boolean().default(false) })
  .strict()
  .openapi("InstallAiToolInput");

/** `null` goes back to the version shipped with the image. */
export const ActivateAiToolInputSchema = z
  .object({ version: AiToolVersionSchema.nullable() })
  .strict()
  .openapi("ActivateAiToolInput");

export const AiToolJobOutputSchema = z
  .object({
    jobId: z.uuid(),
    provider: AiProviderSchema,
    version: AiToolVersionSchema,
    status: z.enum(aiToolEventStatuses),
    step: z.enum(aiToolInstallSteps),
    failureCode: z.enum(aiToolFailureCodes).nullable(),
    startedAt: z.iso.datetime(),
  })
  .openapi("AiToolJob");

export const AiToolReleaseOutputSchema = z
  .object({
    version: AiToolVersionSchema,
    releasedAt: z.iso.datetime(),
    eligibleAt: z.iso.datetime(),
    blocker: z.enum(aiToolFailureCodes).nullable(),
  })
  .openapi("AiToolRelease");

export const AiToolOutputSchema = z
  .object({
    provider: AiProviderSchema,
    bundledVersion: AiToolVersionSchema.nullable(),
    /** `null` while the image's version is in use. */
    activeVersion: AiToolVersionSchema.nullable(),
    previousVersion: AiToolVersionSchema.nullable(),
    latest: AiToolReleaseOutputSchema.nullable(),
    job: AiToolJobOutputSchema.nullable(),
  })
  .openapi("AiTool");

export const AiToolEventOutputSchema = z
  .object({
    id: z.uuid(),
    provider: AiProviderSchema,
    action: z.enum(aiToolEventActions),
    fromVersion: AiToolVersionSchema.nullable(),
    toVersion: AiToolVersionSchema.nullable(),
    status: z.enum(aiToolEventStatuses),
    failureCode: z.enum(aiToolFailureCodes).nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("AiToolEvent");

/** Everyone may ask; only the installation admin gets the tools. */
export const AiToolsOutputSchema = z
  .object({ allowed: z.boolean(), items: z.array(AiToolOutputSchema) })
  .openapi("AiTools");

/** Every change to the tools in this installation, newest first. */
export const AiToolEventsOutputSchema = z
  .object({ items: z.array(AiToolEventOutputSchema) })
  .openapi("AiToolEvents");

export type InstallAiToolInput = z.infer<typeof InstallAiToolInputSchema>;
export type ActivateAiToolInput = z.infer<typeof ActivateAiToolInputSchema>;
export type AiToolJobOutput = z.infer<typeof AiToolJobOutputSchema>;
export type AiToolOutput = z.infer<typeof AiToolOutputSchema>;
export type AiToolEventOutput = z.infer<typeof AiToolEventOutputSchema>;
export type AiToolsOutput = z.infer<typeof AiToolsOutputSchema>;
export type AiToolEventsOutput = z.infer<typeof AiToolEventsOutputSchema>;
