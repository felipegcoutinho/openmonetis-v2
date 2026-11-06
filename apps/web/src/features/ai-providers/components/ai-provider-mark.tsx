import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { Image } from "@unpic/react";
import { cn } from "@/lib/utils";
import { aiProviderLogos } from "../ai-providers.presentation";

/** Provider brand mark; the logo swaps with the theme when it has variants. */
export function AiProviderMark({
  className,
  provider,
  size = 28,
}: {
  className?: string;
  provider: AiProvider;
  size?: number;
}) {
  const logo = aiProviderLogos[provider];
  const themed = logo.light !== logo.dark;
  const imageProps = { alt: "", height: size, layout: "fixed", width: size } as const;

  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0", className)}>
      <Image
        {...imageProps}
        className={cn("object-contain", themed && "dark:hidden")}
        src={logo.light}
      />
      {themed ? (
        <Image {...imageProps} className="hidden object-contain dark:block" src={logo.dark} />
      ) : null}
    </span>
  );
}
