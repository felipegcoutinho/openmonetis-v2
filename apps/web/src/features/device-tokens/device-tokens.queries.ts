import { queryOptions } from "@tanstack/react-query";
import { getDeviceTokens } from "./device-tokens.api";

export const deviceTokenKeys = { all: ["device-tokens"] as const };

export function deviceTokensQueryOptions() {
  return queryOptions({ queryKey: deviceTokenKeys.all, queryFn: getDeviceTokens });
}
