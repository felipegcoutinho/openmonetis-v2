import { WifiOff } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Connection status, like a native app: a bar under the top bar while offline (the screen keeps
 * what it already loaded) and a short confirmation when the connection returns.
 */
export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Conexão restabelecida", { id: "connection-status" });
    }
  }, [online]);

  if (online) return null;
  return (
    <div
      className="material fixed inset-x-0 top-[calc(var(--navbar-height)+var(--safe-top))] z-40 flex items-center justify-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span>Sem conexão. Os dados na tela podem estar desatualizados.</span>
    </div>
  );
}
