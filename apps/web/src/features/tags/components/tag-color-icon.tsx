import type { TagOutput } from "@openmonetis/validators/tags";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColorTokens } from "../tags.presentation";

/** Tag icon tinted with the tag's color, used wherever a tag is listed. */
export function TagColorIcon({
  color,
  className,
}: {
  color: TagOutput["color"];
  className?: string;
}) {
  return (
    <Tag
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      style={{ color: tagColorTokens[color] }}
    />
  );
}
