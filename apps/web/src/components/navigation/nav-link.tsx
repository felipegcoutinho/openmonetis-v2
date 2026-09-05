import { Link, useLocation } from "@tanstack/react-router";
import type { AnchorHTMLAttributes } from "react";

const PERIOD_PARAM = "period";

type NavLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  preservePeriod?: boolean;
  search?: Record<string, string>;
};

export function NavLink({ href, preservePeriod, search, ...props }: NavLinkProps) {
  const location = useLocation();
  const currentParams = new URLSearchParams(location.searchStr);
  const period = preservePeriod ? currentParams.get(PERIOD_PARAM) : null;

  return (
    <Link
      {...props}
      search={{ ...search, ...(period ? { [PERIOD_PARAM]: period } : {}) } as never}
      to={href as never}
    />
  );
}
