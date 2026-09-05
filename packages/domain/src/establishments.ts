const combiningMarks = /[\u0300-\u036f]/g;
const nonAlphanumeric = /[^a-z0-9]+/g;

export function createEstablishmentNameKey(name: string) {
  return name
    .trim()
    .normalize("NFD")
    .replace(combiningMarks, "")
    .toLowerCase()
    .replace(nonAlphanumeric, " ")
    .trim()
    .replaceAll(" ", "-");
}

export function createEstablishmentInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const selected = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words.at(-1)?.[0]}`;
  return selected.toLocaleUpperCase("pt-BR");
}

export function normalizeLogoDomain(domain: string) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}
