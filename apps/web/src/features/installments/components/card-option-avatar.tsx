import { Image } from "@unpic/react";
import { CreditCard } from "lucide-react";

/** Card logo for selects and rows, falling back to a generic card icon. */
export function CardOptionAvatar({ logo }: { logo: string | null }) {
  return logo ? (
    <Image
      alt=""
      className="size-5 shrink-0 rounded-full object-contain"
      height={20}
      layout="fixed"
      src={logo}
      width={20}
    />
  ) : (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
      <CreditCard aria-hidden="true" className="size-3" />
    </span>
  );
}
