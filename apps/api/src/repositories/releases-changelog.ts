import type { ReleaseSectionType } from "@openmonetis/domain/releases";
import type { ReleaseCatalogEntry } from "../services/releases.service";

const sectionTypesByHeading: Record<string, ReleaseSectionType> = {
  Adicionado: "added",
  Added: "added",
  Alterado: "changed",
  Changed: "changed",
  Descontinuado: "deprecated",
  Deprecated: "deprecated",
  Removido: "removed",
  Removed: "removed",
  Corrigido: "fixed",
  Fixed: "fixed",
  Segurança: "security",
  Security: "security",
};

export function parseChangelog(contents: string): ReleaseCatalogEntry[] {
  const releases: ReleaseCatalogEntry[] = [];
  let current: ReleaseCatalogEntry | null = null;
  let currentSection: ReleaseCatalogEntry["sections"][number] | null = null;
  let summaryLines: string[] = [];

  function finishSection() {
    if (current && currentSection && currentSection.items.length > 0) {
      current.sections.push(currentSection);
    }
    currentSection = null;
  }

  function finishRelease() {
    if (!current) return;
    finishSection();
    current.summary = summaryLines.join(" ").trim();
    if (!current.summary) throw new Error(`Release ${current.version} must include a summary`);
    releases.push(current);
    current = null;
    summaryLines = [];
  }

  for (const line of contents.split(/\r?\n/)) {
    const releaseMatch =
      /^## \[((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\] - (\d{4}-\d{2}-\d{2})$/.exec(line);
    if (releaseMatch) {
      finishRelease();
      current = {
        version: releaseMatch[1] as string,
        date: releaseMatch[2] as string,
        summary: "",
        sections: [],
      };
      continue;
    }

    if (!current) continue;

    const sectionMatch = /^### (.+)$/.exec(line);
    if (sectionMatch) {
      finishSection();
      const type = sectionTypesByHeading[sectionMatch[1] as string];
      currentSection = type ? { type, items: [] } : null;
      continue;
    }

    const itemMatch = /^- (.+)$/.exec(line);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1] as string);
      continue;
    }

    const continuationMatch = /^\s{2,}(\S.*)$/.exec(line);
    if (continuationMatch && currentSection && currentSection.items.length > 0) {
      const itemIndex = currentSection.items.length - 1;
      currentSection.items[itemIndex] =
        `${currentSection.items[itemIndex]} ${continuationMatch[1]}`;
      continue;
    }

    if (!currentSection && line.trim()) summaryLines.push(line.trim());
  }

  finishRelease();
  return releases;
}
