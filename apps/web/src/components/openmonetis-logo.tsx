import { Image } from "@unpic/react";
import { cn } from "@/lib/utils";

type OpenMonetisLogoProps = {
  className?: string;
  compactOnMobile?: boolean;
  onPrimary?: boolean;
};

export function OpenMonetisLogo({
  className,
  compactOnMobile = false,
  onPrimary = false,
}: OpenMonetisLogoProps) {
  return (
    <span
      aria-label="OpenMonetis"
      className={cn("flex shrink-0 items-center gap-0", className)}
      role="img"
    >
      <Image
        alt=""
        className={cn(
          "h-9 w-auto shrink-0 object-contain",
          onPrimary && "brightness-0 saturate-0 dark:brightness-100 dark:saturate-100",
        )}
        height={36}
        layout="fixed"
        src="/images/openmonetis-mark.svg"
        width={35}
      />
      <Image
        alt=""
        className={cn(
          "h-[1.3125rem] w-auto shrink-0 object-contain dark:invert",
          compactOnMobile && "hidden sm:block",
        )}
        height={21}
        layout="fixed"
        src="/images/openmonetis-wordmark.svg"
        width={134}
      />
    </span>
  );
}
