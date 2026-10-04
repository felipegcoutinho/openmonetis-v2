import { useEffect, useState } from "react";
import {
  mobileNavigationHideDistance,
  mobileNavigationShowDistance,
  mobileNavigationTopThreshold,
} from "../components/navigation/navbar-options";

export function useMobileNavigationVisibility(isMobile: boolean | null) {
  const [mobileNavigationHidden, setMobileNavigationHidden] = useState(false);
  useEffect(() => {
    if (!isMobile) return;

    setMobileNavigationHidden(false);
    let previousScrollY = window.scrollY;
    let directionalDistance = 0;
    let frameId = 0;

    function updateVisibility() {
      frameId = 0;
      const scrollY = Math.max(0, window.scrollY);
      const delta = scrollY - previousScrollY;
      previousScrollY = scrollY;

      if (scrollY <= mobileNavigationTopThreshold) {
        directionalDistance = 0;
        setMobileNavigationHidden(false);
        return;
      }

      directionalDistance =
        Math.sign(delta) === Math.sign(directionalDistance) ? directionalDistance + delta : delta;

      if (directionalDistance >= mobileNavigationHideDistance) {
        setMobileNavigationHidden(true);
        directionalDistance = 0;
      } else if (directionalDistance <= -mobileNavigationShowDistance) {
        setMobileNavigationHidden(false);
        directionalDistance = 0;
      }
    }

    function handleScroll() {
      if (!frameId) frameId = window.requestAnimationFrame(updateVisibility);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [isMobile]);
  return mobileNavigationHidden;
}
