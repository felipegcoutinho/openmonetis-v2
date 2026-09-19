import { ArrowRight } from "lucide-react";

export function DashboardItemLinkArrow() {
  return (
    <span
      aria-hidden="true"
      className="grid w-0 shrink-0 -translate-x-1 place-items-center overflow-hidden opacity-0 transition-[width,opacity,transform] duration-200 ease-out group-hover:w-3 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:w-3 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
    >
      <ArrowRight className="size-3 max-w-none" />
    </span>
  );
}
