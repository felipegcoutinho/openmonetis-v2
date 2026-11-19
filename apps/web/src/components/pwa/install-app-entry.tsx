import { Image } from "@unpic/react";
import { Download, Share, SquarePlus } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const iosSteps = [
  { icon: Share, text: "Toque em Compartilhar, na barra do navegador." },
  { icon: SquarePlus, text: "Escolha Adicionar à Tela de Início." },
  { icon: Download, text: "Confirme em Adicionar. O OpenMonetis abre em tela cheia, como um app." },
];

/** Menu entry that installs the app, or explains how on iPhone, until it is installed. */
export function InstallAppEntry({ onInstalling }: { onInstalling?: () => void }) {
  const { availability, install } = useInstallPrompt();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  if (availability === "installed" || availability === "unavailable") return null;

  return (
    <>
      {/* The whole card is the target; the pill only signals the action, like an App Store row. */}
      <button
        className="pressable flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-xs outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => {
          if (availability === "manual") {
            setInstructionsOpen(true);
            return;
          }
          onInstalling?.();
          void install();
        }}
        type="button"
      >
        <Image
          alt=""
          className="size-11 shrink-0 rounded-[22.5%] ring-1 ring-foreground/10"
          height={44}
          layout="fixed"
          src="/icon-192.png"
          width={44}
        />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-semibold text-sm">Instalar o app</span>
          <span className="text-muted-foreground text-xs leading-snug">
            Abra pela tela inicial, em tela cheia.
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground text-xs">
          {availability === "manual" ? "Ver como" : "Instalar"}
        </span>
      </button>
      <Sheet onOpenChange={setInstructionsOpen} open={instructionsOpen}>
        <SheetContent
          className="max-h-[min(80svh,32rem)] rounded-t-2xl pb-[max(1rem,var(--safe-bottom))]"
          side="bottom"
        >
          <SheetHeader className="pt-6">
            <SheetTitle>Instalar no iPhone</SheetTitle>
            <SheetDescription>São três toques, direto no navegador.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ol className="grid gap-3">
              {iosSteps.map((step, index) => (
                <li className="flex items-center gap-3" key={step.text}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-foreground">
                    <step.icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-sm">
                    <span className="font-medium">{index + 1}. </span>
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
