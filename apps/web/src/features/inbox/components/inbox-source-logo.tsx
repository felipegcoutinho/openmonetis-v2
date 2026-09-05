import { Image } from "@unpic/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInboxSourceInitials, type InboxSourceMatch } from "../inbox.presentation";

export function InboxSourceLogo({
  className,
  match,
  size,
}: {
  className?: string;
  match: InboxSourceMatch | null;
  size: number;
}) {
  if (!match) {
    return (
      <Image
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
        height={size}
        layout="fixed"
        src="/avatars/default_icon.png"
        width={size}
      />
    );
  }

  if (match.logo) {
    return (
      <Image
        alt=""
        className={cn("shrink-0 rounded-full object-contain", className)}
        height={size}
        layout="fixed"
        src={match.logo}
        width={size}
      />
    );
  }

  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarFallback className="bg-brand/10 font-medium text-brand-strong text-[10px]">
        {getInboxSourceInitials(match.name)}
      </AvatarFallback>
    </Avatar>
  );
}
