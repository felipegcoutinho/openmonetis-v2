import { z } from "@hono/zod-openapi";
import {
  inboxRuleConditionValueMaximumLength,
  inboxRuleMatchModes,
  inboxRuleMaximumConditions,
  inboxRuleNameMaximumLength,
  inboxRuleNumericConditionOperators,
  inboxRulePriorityMaximum,
  inboxRulePriorityMinimum,
  inboxRuleTextConditionFields,
  inboxRuleTextConditionOperators,
} from "@openmonetis/domain/inbox-rules";

const InboxRuleNameSchema = z.string().trim().min(1).max(inboxRuleNameMaximumLength);
const InboxRulePrioritySchema = z
  .number()
  .int()
  .min(inboxRulePriorityMinimum)
  .max(inboxRulePriorityMaximum);

const InboxRuleTextConditionSchema = z
  .object({
    field: z.enum(inboxRuleTextConditionFields),
    operator: z.enum(inboxRuleTextConditionOperators),
    value: z.string().trim().min(1).max(inboxRuleConditionValueMaximumLength),
  })
  .strict();

const InboxRuleAmountConditionSchema = z
  .object({
    field: z.literal("parsedAmount"),
    operator: z.enum(inboxRuleNumericConditionOperators),
    value: z.number().positive().max(999_999_999.99),
  })
  .strict();

export const InboxRuleConditionSchema = z
  .union([InboxRuleTextConditionSchema, InboxRuleAmountConditionSchema])
  .openapi("InboxRuleCondition");

const InboxRuleEditableFieldsSchema = z
  .object({
    name: InboxRuleNameSchema,
    priority: InboxRulePrioritySchema,
    isActive: z.boolean(),
    matchMode: z.enum(inboxRuleMatchModes),
    conditions: z.array(InboxRuleConditionSchema).min(1).max(inboxRuleMaximumConditions),
    categoryId: z.uuid().nullable(),
    personId: z.uuid().nullable(),
  })
  .strict()
  .refine((input) => input.categoryId !== null || input.personId !== null, {
    message: "At least one action is required",
  });

export const CreateInboxRuleInputSchema =
  InboxRuleEditableFieldsSchema.openapi("CreateInboxRuleInput");

export const ReplaceInboxRuleInputSchema = InboxRuleEditableFieldsSchema.safeExtend({
  expectedVersion: z.number().int().positive(),
}).openapi("ReplaceInboxRuleInput");

export const SetInboxRuleActiveInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    isActive: z.boolean(),
  })
  .strict()
  .openapi("SetInboxRuleActiveInput");

export const InboxRuleParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("InboxRuleParams");

export const InboxRuleSuggestionParamsSchema = z
  .object({
    inboxItemId: z.uuid().openapi({ param: { name: "inboxItemId", in: "path" } }),
  })
  .openapi("InboxRuleSuggestionParams");

export const DeleteInboxRuleQuerySchema = z
  .object({ expectedVersion: z.coerce.number().int().positive() })
  .openapi("DeleteInboxRuleQuery");

const InboxRuleTargetOutputSchema = z.object({ id: z.uuid(), name: z.string() });

export const InboxRuleOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    priority: z.number().int(),
    isActive: z.boolean(),
    matchMode: z.enum(inboxRuleMatchModes),
    conditions: z.array(InboxRuleConditionSchema),
    category: InboxRuleTargetOutputSchema.nullable(),
    person: InboxRuleTargetOutputSchema.nullable(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("InboxRule");

export const InboxRulesListOutputSchema = z
  .object({
    items: z.array(InboxRuleOutputSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("InboxRulesList");

export const InboxRuleSuggestionOutputSchema = z
  .object({
    categoryId: z.uuid().nullable(),
    personId: z.uuid().nullable(),
    appliedRules: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        fields: z.array(z.enum(["categoryId", "personId"])).min(1),
      }),
    ),
  })
  .openapi("InboxRuleSuggestion");

export type InboxRuleCondition = z.infer<typeof InboxRuleConditionSchema>;
export type CreateInboxRuleInput = z.infer<typeof CreateInboxRuleInputSchema>;
export type ReplaceInboxRuleInput = z.infer<typeof ReplaceInboxRuleInputSchema>;
export type SetInboxRuleActiveInput = z.infer<typeof SetInboxRuleActiveInputSchema>;
export type InboxRuleOutput = z.infer<typeof InboxRuleOutputSchema>;
export type InboxRulesListOutput = z.infer<typeof InboxRulesListOutputSchema>;
export type InboxRuleSuggestionOutput = z.infer<typeof InboxRuleSuggestionOutputSchema>;
