import type {
  EstablishmentLogoOutput,
  EstablishmentLogoSearchResult,
} from "@openmonetis/validators/establishments";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, { errorMessage: "Não foi possível carregar o logo." });
}

export function getEstablishmentLogo(name: string) {
  return request<EstablishmentLogoOutput>(`/establishments/logo?name=${encodeURIComponent(name)}`);
}
export function searchEstablishmentLogos(query: string) {
  return request<EstablishmentLogoSearchResult[]>(
    `/establishments/logo/search?q=${encodeURIComponent(query)}`,
  );
}
export function setEstablishmentLogo(name: string, domain: string) {
  return request<EstablishmentLogoOutput>("/establishments/logo", {
    method: "PUT",
    body: JSON.stringify({ name, domain }),
  });
}
export function removeEstablishmentLogo(name: string) {
  return request<EstablishmentLogoOutput>(`/establishments/logo?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}
