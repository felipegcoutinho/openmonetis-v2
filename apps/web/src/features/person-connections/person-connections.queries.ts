import { queryOptions } from "@tanstack/react-query";
import { getPersonConnectionInvitations, getPersonConnections } from "./person-connections.api";

export const personConnectionKeys = {
  all: ["person-connections"] as const,
  connections: () => ["person-connections", "connections"] as const,
  invitations: () => ["person-connections", "invitations"] as const,
};

export const personConnectionsQueryOptions = () =>
  queryOptions({ queryKey: personConnectionKeys.connections(), queryFn: getPersonConnections });
export const personConnectionInvitationsQueryOptions = () =>
  queryOptions({
    queryKey: personConnectionKeys.invitations(),
    queryFn: getPersonConnectionInvitations,
  });
