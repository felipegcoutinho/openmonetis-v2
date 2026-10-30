import { useEffect } from "react";
import { siteName } from "@/lib/seo";

/**
 * Names the browser tab after data that only exists once a query resolves (e.g. a card name).
 * The route `head` keeps the static fallback title; the previous title returns on unmount.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const previousTitle = document.title;
    document.title = `${title} · ${siteName}`;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
