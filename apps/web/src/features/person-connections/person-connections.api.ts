import type {
  ClaimedPersonConnectionInvitationOutput,
  ClaimPersonConnectionInvitationInput,
  ConfirmPersonConnectionInput,
  CreatedPersonConnectionInvitationOutput,
  CreatePersonConnectionInvitationInput,
  PersonConnectionInvitationOutput,
  PersonConnectionOutput,
} from "@openmonetis/validators/person-connections";
import { requestApi as request } from "@/lib/api-client";

export const getPersonConnections = () => request<PersonConnectionOutput[]>("/person-connections");
export const getPersonConnectionInvitations = () =>
  request<PersonConnectionInvitationOutput[]>("/person-connections/invitations");
export const createPersonConnectionInvitation = (personId: string) =>
  request<CreatedPersonConnectionInvitationOutput>("/person-connections/invitations", {
    method: "POST",
    body: JSON.stringify({ personId } satisfies CreatePersonConnectionInvitationInput),
  });
export const claimPersonConnectionInvitation = (token: string) =>
  request<ClaimedPersonConnectionInvitationOutput>("/person-connections/invitations/claim", {
    method: "POST",
    body: JSON.stringify({ token } satisfies ClaimPersonConnectionInvitationInput),
  });
export const confirmPersonConnectionInvitation = (id: string, confirmationCode: string) =>
  request<PersonConnectionOutput>(`/person-connections/invitations/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify({ confirmationCode } satisfies ConfirmPersonConnectionInput),
  });
export const cancelPersonConnectionInvitation = (id: string) =>
  request<PersonConnectionInvitationOutput>(`/person-connections/invitations/${id}/cancel`, {
    method: "POST",
  });
export const revokePersonConnection = (id: string) =>
  request<PersonConnectionOutput>(`/person-connections/${id}`, { method: "DELETE" });
