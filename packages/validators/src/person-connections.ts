import { z } from "@hono/zod-openapi";
import {
  personConnectionConfirmationCodeLength,
  personConnectionInvitationStatuses,
  personConnectionStatuses,
} from "@openmonetis/domain/person-connections";

export const PersonConnectionParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
});

export const CreatePersonConnectionInvitationInputSchema = z
  .object({ personId: z.uuid() })
  .strict()
  .openapi("CreatePersonConnectionInvitationInput");

export const ClaimPersonConnectionInvitationInputSchema = z
  .object({ token: z.string().min(32).max(512) })
  .strict()
  .openapi("ClaimPersonConnectionInvitationInput");

export const ConfirmPersonConnectionInputSchema = z
  .object({
    confirmationCode: z
      .string()
      .regex(new RegExp(`^\\d{${personConnectionConfirmationCodeLength}}$`)),
  })
  .strict()
  .openapi("ConfirmPersonConnectionInput");

export const PersonConnectionOutputSchema = z
  .object({
    id: z.uuid(),
    invitationId: z.uuid(),
    personId: z.uuid().nullable(),
    perspective: z.enum(["owner", "recipient"]),
    status: z.enum(personConnectionStatuses),
    counterpartName: z.string(),
    counterpartAvatarUrl: z.url().nullable(),
    connectedAt: z.iso.datetime(),
    revokedAt: z.iso.datetime().nullable(),
  })
  .openapi("PersonConnection");

export const PersonConnectionInvitationOutputSchema = z
  .object({
    id: z.uuid(),
    personId: z.uuid(),
    personName: z.string(),
    status: z.enum(personConnectionInvitationStatuses),
    claimedAccountName: z.string().nullable(),
    expiresAt: z.iso.datetime(),
    confirmationExpiresAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("PersonConnectionInvitation");

export const CreatedPersonConnectionInvitationOutputSchema =
  PersonConnectionInvitationOutputSchema.extend({ token: z.string() }).openapi(
    "CreatedPersonConnectionInvitation",
  );

export const ClaimedPersonConnectionInvitationOutputSchema = z
  .object({
    invitationId: z.uuid(),
    ownerName: z.string(),
    personName: z.string(),
    confirmationCode: z.string(),
    confirmationExpiresAt: z.iso.datetime(),
  })
  .openapi("ClaimedPersonConnectionInvitation");

export type CreatePersonConnectionInvitationInput = z.infer<
  typeof CreatePersonConnectionInvitationInputSchema
>;
export type ClaimPersonConnectionInvitationInput = z.infer<
  typeof ClaimPersonConnectionInvitationInputSchema
>;
export type ConfirmPersonConnectionInput = z.infer<typeof ConfirmPersonConnectionInputSchema>;
export type PersonConnectionOutput = z.infer<typeof PersonConnectionOutputSchema>;
export type PersonConnectionInvitationOutput = z.infer<
  typeof PersonConnectionInvitationOutputSchema
>;
export type CreatedPersonConnectionInvitationOutput = z.infer<
  typeof CreatedPersonConnectionInvitationOutputSchema
>;
export type ClaimedPersonConnectionInvitationOutput = z.infer<
  typeof ClaimedPersonConnectionInvitationOutputSchema
>;
