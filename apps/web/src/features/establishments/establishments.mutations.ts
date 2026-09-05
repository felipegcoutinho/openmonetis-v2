import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeEstablishmentLogo, setEstablishmentLogo } from "./establishments.api";
import { establishmentKeys } from "./establishments.queries";

export function useSetEstablishmentLogoMutation(name: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => setEstablishmentLogo(name, domain),
    onSuccess: (logo) => client.setQueryData(establishmentKeys.logo(name), logo),
  });
}
export function useRemoveEstablishmentLogoMutation(name: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => removeEstablishmentLogo(name),
    onSuccess: (logo) => client.setQueryData(establishmentKeys.logo(name), logo),
  });
}
