import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDeviceTokenQrCodeValue,
  formatDeviceTokenRecentCaptures,
} from "./device-tokens.presentation";

test("device token QR value uses the versioned Companion protocol", () => {
  const token = `opm_${"a".repeat(43)}`;

  assert.equal(
    formatDeviceTokenQrCodeValue(token),
    `openmonetis://companion/token?v=1&token=${token}`,
  );
});

test("device token activity names the capture window", () => {
  assert.equal(formatDeviceTokenRecentCaptures(0), "Nenhuma captura nos últimos 7 dias");
  assert.equal(formatDeviceTokenRecentCaptures(1), "1 captura nos últimos 7 dias");
  assert.equal(formatDeviceTokenRecentCaptures(12), "12 capturas nos últimos 7 dias");
});
