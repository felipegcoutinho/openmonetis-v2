import { formatDateInBrazil, periodToSafeInstant } from "@openmonetis/shared/date-time";
import {
  maximumPersonAvatarDataUrlLength,
  type PersonFinancialSummaryOutput,
  type PersonOutput,
} from "@openmonetis/validators/people";

type PersonPaymentMethod = PersonFinancialSummaryOutput["paymentMethods"][number]["paymentMethod"];

export const personRoleLabels: Record<PersonOutput["role"], string> = {
  admin: "Pessoa principal",
  external: "Pessoa",
};

export const personStatusLabels: Record<PersonOutput["status"], string> = {
  active: "Ativa",
  inactive: "Inativa",
};

export function formatPersonCreatedAt(value: string) {
  return formatDateInBrazil(new Date(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replaceAll(".", "");
}

export const personPaymentMethodLabels: Record<PersonPaymentMethod, string> = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  cash: "Dinheiro",
  boleto: "Boleto",
  benefits: "Benefícios",
  bank_transfer: "Transf. bancária",
};

export function formatPersonHistoryPeriod(period: string) {
  return formatDateInBrazil(periodToSafeInstant(period), { month: "short" }).replace(".", "");
}

export const personAvatarFileAccept = "image/jpeg,image/png,image/webp";
const maximumPersonAvatarFileBytes = 5 * 1024 * 1024;

const personAvatarMaximumDimension = 200;
const supportedPersonAvatarMimeTypes = new Set(personAvatarFileAccept.split(","));

export class PersonAvatarFileError extends Error {
  constructor(public readonly code: "unsupported-type" | "file-too-large" | "processing-failed") {
    super(code);
  }
}

export async function convertPersonAvatarToDataUrl(file: File) {
  if (!supportedPersonAvatarMimeTypes.has(file.type)) {
    throw new PersonAvatarFileError("unsupported-type");
  }
  if (file.size > maximumPersonAvatarFileBytes) {
    throw new PersonAvatarFileError("file-too-large");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(
    1,
    personAvatarMaximumDimension / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PersonAvatarFileError("processing-failed");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const result = canvas.toDataURL("image/jpeg", 0.85);
  if (result.length > maximumPersonAvatarDataUrlLength) {
    throw new PersonAvatarFileError("file-too-large");
  }
  return result;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new PersonAvatarFileError("processing-failed"));
    });
    reader.addEventListener("error", () => reject(new PersonAvatarFileError("processing-failed")));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
      else reject(new PersonAvatarFileError("processing-failed"));
    });
    image.addEventListener("error", () => reject(new PersonAvatarFileError("processing-failed")));
    image.src = source;
  });
}
