import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const getServerSnapshot = () => false;

function getBrowserSnapshot() {
  return window.isSecureContext && typeof window.PublicKeyCredential !== "undefined";
}

export function usePasskeySupport() {
  return useSyncExternalStore(subscribe, getBrowserSnapshot, getServerSnapshot);
}
