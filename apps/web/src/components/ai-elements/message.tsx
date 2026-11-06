import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** AI Elements `Message`, adapted to Base UI and without attachments or branches. */
export type MessageProps = HTMLAttributes<HTMLDivElement> & { from: "user" | "assistant" };

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
        className,
      )}
      {...props}
    />
  );
}

export function MessageContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
        "group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
        "group-[.is-assistant]:w-full group-[.is-assistant]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MessageActions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />;
}

export type MessageActionProps = ComponentProps<typeof Button> & { label: string };

export function MessageAction({
  label,
  children,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button aria-label={label} size={size} type="button" variant={variant} {...props} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

/** Markdown that tolerates half-written blocks while a reply streams in. */
export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      {...props}
    />
  ),
  (previous, next) => previous.children === next.children,
);
MessageResponse.displayName = "MessageResponse";
