import assert from "node:assert/strict";
import test from "node:test";
import { formatDeviceTokenQrCodeValue } from "./device-tokens.presentation";

test("device token QR value uses the versioned Companion protocol", () => {
  const token = `opm_${"a".repeat(43)}`;

  assert.equal(
    formatDeviceTokenQrCodeValue(token),
    `openmonetis://companion/token?v=1&token=${token}`,
  );
});
