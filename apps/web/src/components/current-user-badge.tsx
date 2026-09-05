import { Badge } from "@/components/ui/badge";

export function CurrentUserBadge() {
  return (
    <Badge className="border-info/20 bg-info/10 px-1.5 text-info text-[0.65rem]" variant="outline">
      Você
    </Badge>
  );
}
