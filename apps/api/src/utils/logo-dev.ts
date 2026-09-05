import { normalizeLogoDomain } from "@openmonetis/domain/establishments";
import type { EstablishmentLogoSearchResult } from "@openmonetis/validators/establishments";
import type { EstablishmentLogosGateway } from "../services/establishments.service";

type LogoDevSearchItem = { name?: unknown; domain?: unknown };

const searchUrl = "https://api.logo.dev/search";

function createLogoDevGateway(options: {
  publicKey?: string;
  secretKey?: string;
  request?: typeof fetch;
}): EstablishmentLogosGateway {
  const publicKey = options.publicKey?.trim();
  const secretKey = options.secretKey?.trim();
  const request = options.request ?? fetch;

  function buildLogoUrl(domain: string | null) {
    return domain && publicKey
      ? `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(publicKey)}&size=64&format=png&retina=true`
      : null;
  }

  return {
    enabled: Boolean(publicKey && secretKey),
    buildLogoUrl,
    async search(query): Promise<EstablishmentLogoSearchResult[]> {
      if (!publicKey || !secretKey) return [];

      const response = await request(`${searchUrl}?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (!response.ok) throw new Error("Logo.dev request failed");

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) return [];

      const seen = new Set<string>();
      return (payload as LogoDevSearchItem[])
        .flatMap((item) => {
          if (typeof item.name !== "string" || typeof item.domain !== "string") return [];
          const domain = normalizeLogoDomain(item.domain);
          const logoUrl = buildLogoUrl(domain);
          if (!logoUrl || seen.has(domain)) return [];
          seen.add(domain);
          return [{ name: item.name, domain, logoUrl }];
        })
        .slice(0, 12);
    },
  };
}

export const logoDevGateway = createLogoDevGateway({
  publicKey: process.env.LOGO_DEV_PUBLISHABLE_KEY ?? process.env.LOGO_DEV_TOKEN,
  secretKey: process.env.LOGO_DEV_SECRET_KEY,
});
