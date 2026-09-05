import {
  createEstablishmentNameKey,
  normalizeLogoDomain,
} from "@openmonetis/domain/establishments";
import type {
  EstablishmentLogoSearchResult,
  SetEstablishmentLogoInput,
} from "@openmonetis/validators/establishments";
import { serviceUnavailable } from "../utils/errors";

export type EstablishmentsRepository = {
  findLogoDomain(userId: string, nameKey: string): Promise<string | null>;
  saveLogoDomain(userId: string, nameKey: string, domain: string): Promise<void>;
  removeLogoDomain(userId: string, nameKey: string): Promise<void>;
};

export type EstablishmentLogosGateway = {
  enabled: boolean;
  buildLogoUrl(domain: string | null): string | null;
  search(query: string): Promise<EstablishmentLogoSearchResult[]>;
};

export function createEstablishmentsService(
  repository: EstablishmentsRepository,
  logos: EstablishmentLogosGateway,
) {
  return {
    async getLogo(name: string, userId: string) {
      const nameKey = createEstablishmentNameKey(name);
      const domain = await repository.findLogoDomain(userId, nameKey);
      return {
        nameKey,
        domain,
        logoUrl: logos.buildLogoUrl(domain),
        enabled: logos.enabled,
      };
    },
    async setLogo(input: SetEstablishmentLogoInput, userId: string) {
      const nameKey = createEstablishmentNameKey(input.name);
      const domain = normalizeLogoDomain(input.domain);
      await repository.saveLogoDomain(userId, nameKey, domain);
      return {
        nameKey,
        domain,
        logoUrl: logos.buildLogoUrl(domain),
        enabled: logos.enabled,
      };
    },
    async removeLogo(name: string, userId: string) {
      const nameKey = createEstablishmentNameKey(name);
      await repository.removeLogoDomain(userId, nameKey);
      return { nameKey, domain: null, logoUrl: null, enabled: logos.enabled };
    },
    async searchLogos(query: string): Promise<EstablishmentLogoSearchResult[]> {
      if (!logos.enabled) {
        throw serviceUnavailable("Logo search is not configured", "logo_dev_unavailable");
      }

      try {
        return await logos.search(query);
      } catch {
        throw serviceUnavailable("Logo search is unavailable", "logo_dev_unavailable");
      }
    },
  };
}
export type EstablishmentsService = ReturnType<typeof createEstablishmentsService>;
