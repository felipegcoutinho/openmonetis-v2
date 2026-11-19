import { useEffect } from "react";
import { toast } from "sonner";

const updateToastId = "app-update";
const updateCheckIntervalMs = 60 * 60 * 1000;

/**
 * Registers the service worker of the installed app (production only) and offers new versions
 * with a toast instead of reloading on its own, so nothing being typed is lost.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let updateRequested = false;
    let refreshing = false;
    let registration: ServiceWorkerRegistration | undefined;

    function offerUpdate(worker: ServiceWorker) {
      toast("Nova versão disponível", {
        id: updateToastId,
        description: "Atualize para usar as últimas melhorias.",
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "Atualizar",
          onClick: () => {
            updateRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    }

    function watch(worker: ServiceWorker | null) {
      worker?.addEventListener("statechange", () => {
        // The first install has no controller yet: there is nothing to replace.
        if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    }

    function checkForUpdate() {
      if (document.visibilityState === "visible") void registration?.update().catch(() => {});
    }

    // The first install also claims the page; only an accepted update reloads it.
    function reloadOnce() {
      if (!updateRequested || refreshing) return;
      refreshing = true;
      window.location.reload();
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registered) => {
        registration = registered;
        if (registered.waiting && navigator.serviceWorker.controller) {
          offerUpdate(registered.waiting);
        }
        registered.addEventListener("updatefound", () => watch(registered.installing));
      })
      .catch(() => {
        // Without a service worker the app still works online; nothing to tell the person.
      });

    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
    document.addEventListener("visibilitychange", checkForUpdate);
    const interval = window.setInterval(checkForUpdate, updateCheckIntervalMs);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnce);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
