import { useSyncExternalStore } from "react";
import { isAppleTouchDevice, isStandaloneDisplay } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * - `installed`: already running as an app.
 * - `prompt`: the browser can install it in one tap (Chrome, Edge, Samsung Internet).
 * - `manual`: iPhone and iPad, installed from the Share sheet.
 * - `unavailable`: the browser cannot install apps.
 */
export type InstallAvailability = "installed" | "prompt" | "manual" | "unavailable";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedDuringSession = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// The browser fires this once, early, before any menu exists: capture it at load time.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedDuringSession = true;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getAvailability(): InstallAvailability {
  if (installedDuringSession || isStandaloneDisplay()) return "installed";
  if (deferredPrompt) return "prompt";
  if (isAppleTouchDevice()) return "manual";
  return "unavailable";
}

export function useInstallPrompt() {
  const availability = useSyncExternalStore(subscribe, getAvailability, () => "unavailable");

  async function install() {
    const prompt = deferredPrompt;
    if (!prompt) return false;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredPrompt = null;
    emit();
    return choice.outcome === "accepted";
  }

  return { availability, install };
}
