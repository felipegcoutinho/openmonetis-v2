import type { Dispatch, SetStateAction } from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { dashboardNavItem, isPathActive, type NavLinkItem, navSections } from "./nav-items";
import { NavLink } from "./nav-link";
import {
  desktopNavigationActiveClassName,
  desktopNavigationItemClassName,
  desktopNavigationPopupClassName,
  previewNavigationSections,
} from "./navbar-options";
import { NavigationSectionItems } from "./navigation-section-items";
import { PreviewNavigationMenu } from "./preview-navigation-menu";

export function DesktopNavigation({
  location,
  openNavigationSection,
  navigationPopupVariant,
  setOpenNavigationSection,
  setNavigationPopupVariant,
}: {
  location: { pathname: string };
  openNavigationSection: string | null;
  navigationPopupVariant: "default" | "preview";
  setOpenNavigationSection: Dispatch<SetStateAction<string | null>>;
  setNavigationPopupVariant: Dispatch<SetStateAction<"default" | "preview">>;
}) {
  return (
    <nav aria-label="Navegação principal" className="hidden min-w-0 justify-self-center xl:flex">
      <NavigationMenu
        className="justify-start"
        closeDelay={50}
        delay={30}
        onValueChange={(value) => {
          const nextSection = String(value ?? "") || null;
          setOpenNavigationSection(nextSection);
          if (nextSection) {
            setNavigationPopupVariant(
              previewNavigationSections.has(nextSection) ? "preview" : "default",
            );
          }
        }}
        popupClassName={
          navigationPopupVariant === "preview"
            ? "bg-transparent shadow-none ring-0"
            : desktopNavigationPopupClassName
        }
      >
        <NavigationMenuList className="gap-1">
          <NavigationMenuItem>
            <NavLink
              aria-current={location.pathname === dashboardNavItem.href ? "page" : undefined}
              className={cn(
                desktopNavigationItemClassName,
                location.pathname === dashboardNavItem.href && desktopNavigationActiveClassName,
              )}
              href={dashboardNavItem.href}
              preservePeriod
            >
              {dashboardNavItem.label}
            </NavLink>
          </NavigationMenuItem>

          {navSections.map((section) => {
            const sectionActive = section.items.some(
              (item) =>
                "href" in item && !item.isShortcut && isPathActive(location.pathname, item.href),
            );

            return (
              <NavigationMenuItem key={section.label} value={section.label}>
                <NavigationMenuTrigger
                  className={cn(
                    desktopNavigationItemClassName,
                    "focus:bg-muted/70 data-open:bg-muted/70 data-popup-open:bg-muted/70 [&>svg]:size-3 [&>svg]:text-current",
                    sectionActive && desktopNavigationActiveClassName,
                  )}
                >
                  {section.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent
                  className={previewNavigationSections.has(section.label) ? "p-0" : "p-2"}
                >
                  {previewNavigationSections.has(section.label) ? (
                    <PreviewNavigationMenu
                      isOpen={openNavigationSection === section.label}
                      items={section.items.filter((item): item is NavLinkItem => "href" in item)}
                      pathname={location.pathname}
                    />
                  ) : (
                    <NavigationSectionItems
                      className="w-92 max-w-[calc(100vw-2rem)]"
                      items={section.items}
                      pathname={location.pathname}
                    />
                  )}
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  );
}
