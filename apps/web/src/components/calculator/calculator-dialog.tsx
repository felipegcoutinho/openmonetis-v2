import { Calculator as CalculatorIcon } from "lucide-react";
import { useState } from "react";
import { Calculator } from "@/components/calculator/calculator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useDraggableDialog } from "./useDraggableDialog";

type CalculatorDialogProps = {
  initialValue?: string;
  onOpenChange: (open: boolean) => void;
  onSelectValue?: (value: string) => void;
  open: boolean;
};

type CalculatorDialogButtonProps = {
  className?: string;
  disabled?: boolean;
  initialValue?: string;
  onSelectValue: (value: string) => void;
};

export function CalculatorDialog({
  initialValue,
  open,
  onOpenChange,
  onSelectValue,
}: CalculatorDialogProps) {
  return (
    <Dialog
      disablePointerDismissal
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && details.reason === "escape-key") {
          details.cancel();
          return;
        }
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      {open ? (
        <CalculatorDialogContent
          initialValue={initialValue}
          onSelectValue={
            onSelectValue
              ? (value) => {
                  onSelectValue(value);
                  onOpenChange(false);
                }
              : undefined
          }
        />
      ) : null}
    </Dialog>
  );
}

export function CalculatorDialogButton({
  className,
  disabled,
  initialValue,
  onSelectValue,
}: CalculatorDialogButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          aria-label="Abrir calculadora"
          render={
            <Button
              aria-expanded={open}
              aria-haspopup="dialog"
              className={cn("text-muted-foreground", className)}
              disabled={disabled}
              onClick={() => setOpen(true)}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <CalculatorIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Calcular valor</TooltipContent>
      </Tooltip>
      <CalculatorDialog
        initialValue={initialValue}
        onOpenChange={setOpen}
        onSelectValue={onSelectValue}
        open={open}
      />
    </>
  );
}

function CalculatorDialogContent({
  initialValue,
  onSelectValue,
}: {
  initialValue?: string;
  onSelectValue?: (value: string) => void;
}) {
  const { contentRef, dragHandleProps } = useDraggableDialog();
  return (
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[25rem]" ref={contentRef}>
      <DialogHeader
        className="cursor-grab select-none px-5 pt-5 pr-14 pb-4 active:cursor-grabbing sm:px-6 sm:pt-6 sm:pr-14 sm:pb-5"
        {...dragHandleProps}
      >
        <DialogTitle className="flex items-center gap-2.5 text-lg">
          <CalculatorIcon aria-hidden="true" className="size-5 text-brand-strong" />
          Calculadora
        </DialogTitle>
      </DialogHeader>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <p className="mb-2 text-muted-foreground text-xs">
          Esc limpa a conta. Use o botão de fechar para sair.
        </p>
        <Calculator initialValue={initialValue} onSelectValue={onSelectValue} />
      </div>
    </DialogContent>
  );
}
