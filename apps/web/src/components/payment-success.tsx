import { CircleCheck } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";

const confettiColors = ["#fa8a2e", "#fda164", "#ffd4a8", "#c96524", "#8f4218"];

export function PaymentSuccess({
  celebrate,
  description,
  onClose,
  title,
}: {
  celebrate: boolean;
  description: string;
  onClose: () => void;
  title: string;
}) {
  useEffect(() => {
    if (!celebrate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const timers: number[] = [];

    void import("canvas-confetti")
      .then(({ default: confetti }) => {
        if (cancelled) return;

        confetti({
          colors: confettiColors,
          gravity: 1.15,
          origin: { x: 0.5, y: 0.42 },
          particleCount: 64,
          scalar: 0.85,
          spread: 68,
          startVelocity: 26,
          ticks: 170,
        });

        timers.push(
          window.setTimeout(() => {
            confetti({
              colors: confettiColors,
              gravity: 1.1,
              origin: { x: 0.32, y: 0.46 },
              particleCount: 20,
              scalar: 0.75,
              spread: 46,
              startVelocity: 20,
              ticks: 150,
            });
          }, 140),
          window.setTimeout(() => {
            confetti({
              colors: confettiColors,
              gravity: 1.1,
              origin: { x: 0.68, y: 0.46 },
              particleCount: 20,
              scalar: 0.75,
              spread: 46,
              startVelocity: 20,
              ticks: 150,
            });
          }, 220),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [celebrate]);

  return (
    <div className="grid justify-items-center gap-6 px-2 py-7 text-center">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute size-20 rounded-full bg-success/15" />
        <span className="absolute size-16 animate-ping rounded-full bg-success/10 motion-reduce:animate-none" />
        <span className="relative grid size-14 place-items-center rounded-full bg-success text-background shadow-lg">
          <CircleCheck aria-hidden="true" className="size-7" />
        </span>
      </div>

      <div className="grid gap-2">
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <DialogDescription className="max-w-sm leading-relaxed">{description}</DialogDescription>
      </div>

      <Button className="min-w-32" onClick={onClose} type="button">
        Fechar
      </Button>
    </div>
  );
}
