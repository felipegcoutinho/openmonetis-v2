import { createEstablishmentNameKey } from "@openmonetis/domain/establishments";
import { queryOptions } from "@tanstack/react-query";
import { getEstablishmentLogo, searchEstablishmentLogos } from "./establishments.api";

export const establishmentKeys = {
  all: ["establishments"] as const,
  logo: (name: string) =>
    [...establishmentKeys.all, "logo", createEstablishmentNameKey(name)] as const,
  search: (query: string) =>
    [...establishmentKeys.all, "logo-search", query.trim().toLocaleLowerCase("pt-BR")] as const,
};
export const establishmentLogoQueryOptions = (name: string) =>
  queryOptions({
    queryKey: establishmentKeys.logo(name),
    queryFn: () => getEstablishmentLogo(name),
    staleTime: 5 * 60_000,
  });
export const establishmentLogoSearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: establishmentKeys.search(query),
    queryFn: () => searchEstablishmentLogos(query),
    staleTime: 60 * 60_000,
  });
