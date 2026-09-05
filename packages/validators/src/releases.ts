import { z } from "@hono/zod-openapi";
import { releaseSectionTypes } from "@openmonetis/domain/releases";

export const SemanticVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  .openapi("SemanticVersion");

export const ReleaseSectionOutputSchema = z.object({
  type: z.enum(releaseSectionTypes),
  items: z.array(z.string().min(1)),
});

export const ReleaseOutputSchema = z.object({
  version: SemanticVersionSchema,
  date: z.iso.date(),
  summary: z.string().min(1),
  isCurrent: z.boolean(),
  sections: z.array(ReleaseSectionOutputSchema),
});

export const ReleasesOutputSchema = z
  .object({
    currentVersion: SemanticVersionSchema,
    latestVersion: SemanticVersionSchema.nullable(),
    updateAvailable: z.boolean(),
    hasUnseenCurrentRelease: z.boolean(),
    releasesUrl: z.url(),
    latestReleaseUrl: z.url().nullable(),
    releases: z.array(ReleaseOutputSchema),
  })
  .openapi("Releases");

export const ReleaseParamsSchema = z.object({
  version: SemanticVersionSchema.openapi({ param: { name: "version", in: "path" } }),
});

export const MarkReleaseSeenInputSchema = z
  .object({ seen: z.literal(true) })
  .strict()
  .openapi("MarkReleaseSeenInput");

export const MarkReleaseSeenOutputSchema = z
  .object({
    version: SemanticVersionSchema,
    hasUnseenCurrentRelease: z.literal(false),
  })
  .openapi("MarkReleaseSeenOutput");

export type ReleaseOutput = z.infer<typeof ReleaseOutputSchema>;
export type ReleasesOutput = z.infer<typeof ReleasesOutputSchema>;
export type MarkReleaseSeenInput = z.infer<typeof MarkReleaseSeenInputSchema>;
export type MarkReleaseSeenOutput = z.infer<typeof MarkReleaseSeenOutputSchema>;
