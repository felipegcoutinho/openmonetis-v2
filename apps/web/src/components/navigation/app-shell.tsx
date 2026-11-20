import type { ReactNode } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { cn } from "@/lib/utils";

/**
 * Signed-in page frame: the navbar stays outside `<main>` so the header and navigation keep their
 * own landmarks, and `<main>` holds only the page content (WCAG 1.3.1).
 */
export function AppShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-svh bg-background", className)}>
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
