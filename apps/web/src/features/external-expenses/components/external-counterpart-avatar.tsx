import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function ExternalCounterpartAvatar({
  avatarUrl,
  className,
  name,
}: {
  avatarUrl: string | null;
  className?: string;
  name: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");

  return (
    <Avatar className={cn("size-10", className)}>
      <AvatarImage alt={`Avatar de ${name}`} src={avatarUrl ?? undefined} />
      <AvatarFallback className="font-medium text-xs">{initials || "?"}</AvatarFallback>
    </Avatar>
  );
}
