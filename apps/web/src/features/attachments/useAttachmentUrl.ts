import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { attachmentUrlQueryOptions } from "./attachments.queries";

export function useAttachmentUrl(attachmentId: string, enabled: boolean) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!element || !enabled || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin: "160px" },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [element, enabled, isVisible]);

  const query = useQuery(attachmentUrlQueryOptions(attachmentId, enabled && isVisible));

  return { containerRef: setElement, ...query };
}
