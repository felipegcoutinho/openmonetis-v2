import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultUserPreferences } from "@openmonetis/domain/preferences";
import { createPreferencesRoute } from "../routes/preferences";
import { createPreferencesService, type PreferencesRepository } from "./preferences.service";

function setup() {
  let stored = {
    ...createDefaultUserPreferences(),
    theme: "dark" as const,
    hideValuesOnStart: true,
  };
  let writes = 0;
  const repository: PreferencesRepository = {
    findByUserId: async (userId) => {
      assert.equal(userId, "user-a");
      return stored;
    },
    isActiveAccountForUser: async () => false,
    isActiveCardForUser: async () => false,
    saveForUser: async (userId, value) => {
      assert.equal(userId, "user-a");
      writes++;
      stored = value as typeof stored;
    },
    deleteForUser: async () => {
      writes++;
    },
  };
  return { service: createPreferencesService(repository), writes: () => writes };
}

test("previewing default preferences does not change saved preferences", async () => {
  const { service, writes } = setup();
  const before = await service.get("user-a");
  const response = await createPreferencesRoute(service).request("/defaults");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: createDefaultUserPreferences(), error: null });
  assert.deepEqual(await service.get("user-a"), before);
  assert.equal(writes(), 0);
});

test("saving a preference patch preserves settings omitted by the editor", async () => {
  const { service, writes } = setup();
  const saved = await service.update({ transactionsPageSize: 50 }, "user-a");
  assert.equal(saved.transactionsPageSize, 50);
  assert.equal(saved.theme, "dark");
  assert.equal(saved.hideValuesOnStart, true);
  assert.equal(writes(), 1);
});

test("unavailable related IDs are rejected without saving preferences", async () => {
  const { service, writes } = setup();
  await assert.rejects(
    service.update({ defaultAccountId: "00000000-0000-4000-8000-000000000001" }, "user-a"),
  );
  await assert.rejects(
    service.update({ defaultCardId: "00000000-0000-4000-8000-000000000002" }, "user-a"),
  );
  assert.equal(writes(), 0);
});
