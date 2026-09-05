import { z } from "@hono/zod-openapi";

export const PersonRoleSchema = z.enum(["admin", "external"]);
export const PersonStatusSchema = z.enum(["active", "inactive"]);

export const maximumPersonAvatarDataUrlBytes = 256 * 1024;
export const maximumPersonAvatarDataUrlLength =
  Math.ceil(maximumPersonAvatarDataUrlBytes / 3) * 4 + "data:image/webp;base64,".length;

const personAvatarDataUrlPattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function isAcceptedPersonAvatar(value: string) {
  if (value.startsWith("/avatars/")) return value.length <= 255;

  if (personAvatarDataUrlPattern.test(value)) {
    const encodedValue = value.slice(value.indexOf(",") + 1);
    const paddingLength = encodedValue.endsWith("==") ? 2 : encodedValue.endsWith("=") ? 1 : 0;
    const decodedLength = Math.floor((encodedValue.length * 3) / 4) - paddingLength;
    return decodedLength <= maximumPersonAvatarDataUrlBytes;
  }

  if (value.length > 2048) return false;
  const parsedUrl = z.url().safeParse(value);
  if (!parsedUrl.success) return false;
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}

const PersonAvatarUrlValueSchema = z
  .string()
  .trim()
  .max(maximumPersonAvatarDataUrlLength)
  .refine(isAcceptedPersonAvatar, {
    message: "Use a local avatar, an HTTPS URL, or a supported image data URL",
  });

const AvatarUrlSchema = PersonAvatarUrlValueSchema.nullable().optional();

export const CreatePersonInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.email().max(320).nullable().optional(),
    avatarUrl: AvatarUrlSchema,
    note: z.string().trim().max(1000).nullable().optional(),
    status: PersonStatusSchema.default("active"),
  })
  .openapi("CreatePersonInput");

export const ReplacePersonInputSchema = CreatePersonInputSchema.openapi("ReplacePersonInput");
export const UpdatePersonInputSchema = CreatePersonInputSchema.partial()
  .extend({ status: PersonStatusSchema.optional() })
  .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update")
  .openapi("UpdatePersonInput");
export const PersonParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("PersonParams");
export const PersonSummaryQuerySchema = z
  .object({
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .openapi({ param: { name: "period", in: "query" }, example: "2026-07" }),
  })
  .openapi("PersonSummaryQuery");
export const PersonFinancialSummaryOutputSchema = z
  .object({
    period: z.string(),
    totalExpenses: z.number(),
    history: z
      .array(
        z.object({
          period: z.string(),
          expenses: z.number(),
          percentage: z.number().min(0).max(100),
        }),
      )
      .length(6),
    paymentMethods: z.array(
      z.object({
        paymentMethod: z.enum([
          "credit_card",
          "debit_card",
          "pix",
          "cash",
          "boleto",
          "benefits",
          "bank_transfer",
        ]),
        amount: z.number(),
        percentage: z.number().min(0).max(100),
      }),
    ),
  })
  .openapi("PersonFinancialSummaryOutput");
export const PersonOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email().nullable(),
    avatarUrl: z.string().nullable(),
    providerAvatarUrl: z.string().nullable(),
    role: PersonRoleSchema,
    status: PersonStatusSchema,
    note: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("PersonOutput");

export type CreatePersonInput = z.infer<typeof CreatePersonInputSchema>;
export type ReplacePersonInput = z.infer<typeof ReplacePersonInputSchema>;
export type UpdatePersonInput = z.infer<typeof UpdatePersonInputSchema>;
export type PersonOutput = z.infer<typeof PersonOutputSchema>;
export type PersonFinancialSummaryOutput = z.infer<typeof PersonFinancialSummaryOutputSchema>;
