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
  desktopNavigationPanelClassName,
  previewNavigationSections,
} from "./navbar-options";
import { NavigationSectionItems } from "./navigation-section-items";
import { PreviewNavigationMenu } from "./preview-navigation-menu";

export function DesktopNavigation({
  location,
  openNavigationSection,
  setOpenNavigationSection,
}: {
  location: { pathname: string };
  openNavigationSection: string | null;
  setOpenNavigationSection: Dispatch<SetStateAction<string | null>>;
}) {
  return (
    <nav aria-label="Navegação principal" className="hidden min-w-0 justify-self-center xl:flex">
      <NavigationMenu
        className="justify-start"
        closeDelay={50}
        delay={30}
        onValueChange={(value) => setOpenNavigationSection(String(value ?? "") || null)}
        // Every section draws its own panel, so all four menus share the same surface.
        popupClassName="border-0 bg-transparent shadow-none"
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
                    "[&>svg]:size-3 [&>svg]:text-current",
                    sectionActive && desktopNavigationActiveClassName,
                  )}
                >
                  {section.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="p-0">
                  {previewNavigationSections.has(section.label) ? (
                    <PreviewNavigationMenu
                      isOpen={openNavigationSection === section.label}
                      items={section.items.filter((item): item is NavLinkItem => "href" in item)}
                      pathname={location.pathname}
                    />
                  ) : (
                    <div className="w-92 max-w-[calc(100vw-2rem)] p-1">
                      <NavigationSectionItems
                        className={desktopNavigationPanelClassName}
                        items={section.items}
                        pathname={location.pathname}
                      />
                    </div>
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
