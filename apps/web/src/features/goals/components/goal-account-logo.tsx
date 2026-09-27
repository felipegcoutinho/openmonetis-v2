import { Image } from "@unpic/react";
import { cn } from "@/lib/utils";

export function GoalAccountLogo({
  logo,
  name,
  size = 20,
}: {
  logo: string | null;
  name: string;
  size?: 18 | 20 | 24;
}) {
  if (logo) {
    return (
      <Image
        alt=""
        className={cn(
          "shrink-0 rounded-full object-contain",
          size === 18 ? "size-4.5" : size === 24 ? "size-6" : "size-5",
        )}
        height={size}
        layout="fixed"
        src={logo}
        width={size}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-muted font-medium text-muted-foreground",
        size === 18
          ? "size-4.5 text-[9px]"
          : size === 24
            ? "size-6 text-[10px]"
            : "size-5 text-[9px]",
      )}
    >
      {name.slice(0, 1).toLocaleUpperCase("pt-BR")}
    </span>
  );
}
