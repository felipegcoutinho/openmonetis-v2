import { useEffect, useRef } from "react";
import { getFilesFromClipboard } from "./attachments.presentation";

/**
 * Captures files pasted anywhere in the document (e.g. a screenshot with Ctrl+V) while mounted.
 * Pastes without files keep their default behavior, so text fields still receive pasted text.
 */
export function useClipboardFiles(onFiles: (files: File[]) => void, enabled = true) {
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  useEffect(() => {
    if (!enabled) return;

    function handlePaste(event: ClipboardEvent) {
      if (event.defaultPrevented) return;
      const files = getFilesFromClipboard(event);
      if (!files.length) return;

      event.preventDefault();
      onFilesRef.current(files);
    }

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [enabled]);
}
