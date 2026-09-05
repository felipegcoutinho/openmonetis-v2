"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Check } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      data-slot="command"
      {...props}
    />
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-72 overflow-x-hidden overflow-y-auto outline-none", className)}
      data-slot="command-list"
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn("py-6 text-center text-sm", className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs",
        className,
      )}
      data-slot="command-group"
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "group/command-item relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="command-item"
      {...props}
    >
      {children}
      <Check
        aria-hidden="true"
        className="ml-auto size-4 opacity-0 group-data-[checked=true]/command-item:opacity-100"
      />
    </CommandPrimitive.Item>
  );
}

export { Command, CommandEmpty, CommandGroup, CommandItem, CommandList };
