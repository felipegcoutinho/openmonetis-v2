import { z } from "@hono/zod-openapi";

export const EstablishmentNameSchema = z.string().trim().min(1).max(160);
export const LogoDomainSchema = z
  .string()
  .trim()
  .min(3)
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i);

export const EstablishmentLogoQuerySchema = z.object({ name: EstablishmentNameSchema });
export const SearchEstablishmentLogosQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});
export const SetEstablishmentLogoInputSchema = z.object({
  name: EstablishmentNameSchema,
  domain: LogoDomainSchema,
});
export const RemoveEstablishmentLogoQuerySchema = z.object({ name: EstablishmentNameSchema });

export const EstablishmentLogoOutputSchema = z.object({
  nameKey: z.string(),
  domain: z.string().nullable(),
  logoUrl: z.string().nullable(),
  enabled: z.boolean(),
});
export const EstablishmentLogoSearchResultSchema = z.object({
  name: z.string(),
  domain: z.string(),
  logoUrl: z.string(),
});
export const EstablishmentLogoSearchOutputSchema = z.array(EstablishmentLogoSearchResultSchema);

export type EstablishmentLogoOutput = z.infer<typeof EstablishmentLogoOutputSchema>;
export type EstablishmentLogoSearchResult = z.infer<typeof EstablishmentLogoSearchResultSchema>;
export type SetEstablishmentLogoInput = z.infer<typeof SetEstablishmentLogoInputSchema>;
