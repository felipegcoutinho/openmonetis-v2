import { queryOptions } from "@tanstack/react-query";
import { getSettingsSecurity, listPasskeys } from "./settings.api";

export const settingsKeys = {
  all: ["settings"] as const,
  passkeys: () => [...settingsKeys.all, "passkeys"] as const,
  security: () => [...settingsKeys.all, "security"] as const,
};

export function settingsSecurityQueryOptions() {
  return queryOptions({
    queryKey: settingsKeys.security(),
    queryFn: getSettingsSecurity,
  });
}

export function passkeysQueryOptions() {
  return queryOptions({
    queryKey: settingsKeys.passkeys(),
    queryFn: listPasskeys,
  });
}
