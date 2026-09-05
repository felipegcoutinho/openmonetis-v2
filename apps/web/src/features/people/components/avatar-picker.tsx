import { Image } from "@unpic/react";
import { Check, ImagePlus, LoaderCircle } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { avatarOptions } from "../avatar-catalog";
import {
  convertPersonAvatarToDataUrl,
  PersonAvatarFileError,
  personAvatarFileAccept,
} from "../people.presentation";

export function AvatarPicker({
  id,
  onChange,
  onProcessingChange,
  providerAvatarUrl,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  onProcessingChange?: (processing: boolean) => void;
  providerAvatarUrl?: string | null;
  value: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(() =>
    value.startsWith("data:") ? value : null,
  );
  const [processing, setProcessing] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    onProcessingChange?.(true);
    try {
      const avatar = await convertPersonAvatarToDataUrl(file);
      setUploadedAvatar(avatar);
      onChange(avatar);
    } catch (error) {
      const message =
        error instanceof PersonAvatarFileError && error.code === "unsupported-type"
          ? "Escolha uma imagem JPG, PNG ou WebP."
          : error instanceof PersonAvatarFileError && error.code === "file-too-large"
            ? "A imagem deve ter no máximo 5 MB."
            : "Não foi possível processar a imagem.";
      toast.error(message);
    } finally {
      setProcessing(false);
      onProcessingChange?.(false);
      event.target.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {providerAvatarUrl ? (
          <AvatarChoice
            alt="Foto da conta Google"
            onClick={() => onChange(providerAvatarUrl)}
            selected={providerAvatarUrl === value}
            src={providerAvatarUrl}
          />
        ) : null}
        {avatarOptions.map((avatar, index) => (
          <AvatarChoice
            alt={`Avatar padrão ${index + 1}`}
            key={avatar}
            onClick={() => onChange(avatar)}
            selected={avatar === value}
            src={avatar}
          />
        ))}
        <input
          accept={personAvatarFileAccept}
          className="sr-only"
          id={id}
          onChange={handleFileChange}
          ref={fileInput}
          type="file"
        />
        <button
          aria-label={
            uploadedAvatar ? "Trocar imagem personalizada" : "Enviar imagem do computador"
          }
          aria-pressed={uploadedAvatar !== null && uploadedAvatar === value}
          className={`relative grid size-[3.25rem] place-items-center rounded-full border-2 border-solid bg-muted/40 p-0.5 text-muted-foreground shadow-xs outline-none transition-colors hover:border-brand-strong/60 hover:text-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 ${uploadedAvatar !== null && uploadedAvatar === value ? "border-brand-strong ring-2 ring-brand-strong" : "border-muted-foreground/25"}`}
          disabled={processing}
          onClick={() => fileInput.current?.click()}
          type="button"
        >
          {processing ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : uploadedAvatar ? (
            <>
              {uploadedAvatar === value ? <SelectedIndicator /> : null}
              <Image
                alt="Imagem personalizada"
                className="size-12 rounded-full object-cover"
                height={48}
                layout="fixed"
                src={uploadedAvatar}
                width={48}
              />
            </>
          ) : (
            <ImagePlus aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      <p className="text-muted-foreground text-xs">JPG, PNG ou WebP de até 5 MB.</p>
    </div>
  );
}

function AvatarChoice({
  alt,
  onClick,
  selected,
  src,
}: {
  alt: string;
  onClick: () => void;
  selected: boolean;
  src: string;
}) {
  return (
    <button
      aria-label={`Selecionar ${alt.toLocaleLowerCase("pt-BR")}`}
      aria-pressed={selected}
      className={`relative rounded-full p-0.5 shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${selected ? "ring-2 ring-brand-strong" : ""}`}
      onClick={onClick}
      type="button"
    >
      {selected ? <SelectedIndicator /> : null}
      <Image
        alt={alt}
        className="size-12 rounded-full object-cover"
        height={48}
        layout="fixed"
        src={src}
        width={48}
      />
    </button>
  );
}

function SelectedIndicator() {
  return (
    <span className="absolute -top-1 -right-1 z-10 grid size-4 place-items-center rounded-full bg-brand text-brand-foreground">
      <Check aria-hidden="true" className="size-3" />
    </span>
  );
}
