import { List } from "lucide-react";
import type { ReactNode } from "react";
import { MobileSheetContent as SheetContent } from "@/components/forms/mobile-sheet-content";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
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
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <SheetBody>{children}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}
