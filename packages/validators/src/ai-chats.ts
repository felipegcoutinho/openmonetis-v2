import { z } from "@hono/zod-openapi";
import {
  aiChatFailureCodes,
  aiChatMessageMaximumLength,
  aiChatMessageRoles,
  aiChatMessageStatuses,
  aiChatTitleMaximumLength,
} from "@openmonetis/domain/ai-chats";
import { aiDiagnosisVoices } from "@openmonetis/domain/ai-diagnoses";
import { aiProviders } from "@openmonetis/domain/ai-providers";
import { AiDataScopeSchema } from "./ai-data-sharing";
import { AiProviderModelIdSchema } from "./ai-providers";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const usedModelSchema = z.object({ id: z.string(), name: z.string() });
const runTargetShape = {
  provider: z.enum(aiProviders),
  model: AiProviderModelIdSchema.nullable().optional(),
};
/** A reply also picks its writing style; the default is the balanced one. */
const replyShape = { ...runTargetShape, voice: z.enum(aiDiagnosisVoices).optional() };

export const AiChatParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("AiChatParams");

export const CreateAiChatInputSchema = z
  .object({ period: periodSchema, ...runTargetShape })
  .strict()
  .openapi("CreateAiChatInput");

export const UpdateAiChatInputSchema = z
  .object({ title: z.string().trim().min(1).max(aiChatTitleMaximumLength) })
  .strict()
  .openapi("UpdateAiChatInput");

export const SendAiChatMessageInputSchema = z
  .object({
    content: z.string().trim().min(1).max(aiChatMessageMaximumLength),
    ...replyShape,
  })
  .strict()
  .openapi("SendAiChatMessageInput");

export const RegenerateAiChatReplyInputSchema = z
  .object(replyShape)
  .strict()
  .openapi("RegenerateAiChatReplyInput");

export const AiChatMessageOutputSchema = z
  .object({
    id: z.uuid(),
    role: z.enum(aiChatMessageRoles),
    content: z.string(),
    reasoning: z.string().nullable(),
    status: z.enum(aiChatMessageStatuses),
    failureCode: z.enum(aiChatFailureCodes).nullable(),
    provider: z.enum(aiProviders).nullable(),
    model: usedModelSchema.nullable(),
    sharedScopes: z.array(AiDataScopeSchema),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
  })
  .openapi("AiChatMessage");

export const AiChatSummaryOutputSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    period: periodSchema,
    provider: z.enum(aiProviders),
    model: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("AiChatSummary");

export const AiChatOutputSchema = AiChatSummaryOutputSchema.extend({
  messages: z.array(AiChatMessageOutputSchema),
}).openapi("AiChat");

export const AiChatsOutputSchema = z
  .object({ items: z.array(AiChatSummaryOutputSchema) })
  .openapi("AiChats");

/** Server-sent events of a reply, in order: `start`, any `reasoning`/`delta`, then `done`. */
export const AiChatStreamEventSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("start"),
      chat: AiChatSummaryOutputSchema,
      userMessage: AiChatMessageOutputSchema.nullable(),
      assistantMessage: AiChatMessageOutputSchema,
    }),
    z.object({ type: z.literal("delta"), text: z.string() }),
    z.object({ type: z.literal("reasoning"), text: z.string() }),
    z.object({ type: z.literal("done"), message: AiChatMessageOutputSchema }),
  ])
  .openapi("AiChatStreamEvent");

export type CreateAiChatInput = z.infer<typeof CreateAiChatInputSchema>;
export type UpdateAiChatInput = z.infer<typeof UpdateAiChatInputSchema>;
export type SendAiChatMessageInput = z.infer<typeof SendAiChatMessageInputSchema>;
export type RegenerateAiChatReplyInput = z.infer<typeof RegenerateAiChatReplyInputSchema>;
export type AiChatMessageOutput = z.infer<typeof AiChatMessageOutputSchema>;
export type AiChatSummaryOutput = z.infer<typeof AiChatSummaryOutputSchema>;
export type AiChatOutput = z.infer<typeof AiChatOutputSchema>;
export type AiChatsOutput = z.infer<typeof AiChatsOutputSchema>;
export type AiChatStreamEvent = z.infer<typeof AiChatStreamEventSchema>;
