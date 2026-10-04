import { List } from "lucide-react";
import type { ReactNode } from "react";
import { MobileSheetContent as SheetContent } from "@/components/forms/mobile-sheet-content";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function DashboardWidgetListSheet({
  children,
  description,
  onOpenChange,
  open,
  title,
  triggerLabel,
}: {
  children: ReactNode;
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  triggerLabel: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        render={
          <Button
            className="mr-auto h-auto px-0 py-0 font-normal text-muted-foreground text-sm"
            size="sm"
            variant="link"
          />
        }
      >
        <List aria-hidden="true" className="size-4" />
        {triggerLabel}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
