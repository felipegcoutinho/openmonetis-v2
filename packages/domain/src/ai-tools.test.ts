import assert from "node:assert/strict";
import test from "node:test";
import {
  aiToolReleaseEligibleAt,
  aiToolUpdateBlocker,
  aiToolVersionsToRemove,
  compareAiToolVersions,
  isAiToolVersion,
} from "./ai-tools";

test("only stable versions are accepted and they compare numerically", () => {
  assert.equal(isAiToolVersion("2.1.317"), true);
  assert.equal(isAiToolVersion("0.166.0"), true);
  for (const value of ["2.1", "v2.1.3", "2.1.3-beta.1", "01.2.3", "../1.2.3", "1.2.3 "]) {
    assert.equal(isAiToolVersion(value), false, value);
  }
  assert.ok(compareAiToolVersions("2.1.10", "2.1.9") > 0);
  assert.ok(compareAiToolVersions("0.165.0", "0.166.0") < 0);
  assert.equal(compareAiToolVersions("1.4.12", "1.4.12"), 0);
});

test("a release must be newer than the current one and public for three days", () => {
  const releasedAt = new Date("2026-11-01T12:00:00.000Z");
  assert.equal(aiToolReleaseEligibleAt(releasedAt).toISOString(), "2026-11-04T12:00:00.000Z");
  const base = { candidate: "2.1.320", current: "2.1.317", releasedAt };
  assert.equal(
    aiToolUpdateBlocker({ ...base, now: new Date("2026-11-04T11:59:59Z") }),
    "tooRecent",
  );
  assert.equal(aiToolUpdateBlocker({ ...base, now: new Date("2026-11-04T12:00:00Z") }), null);
  assert.equal(
    aiToolUpdateBlocker({ ...base, candidate: "2.1.317", now: new Date("2026-12-01") }),
    "notNewer",
  );
  assert.equal(
    aiToolUpdateBlocker({ ...base, candidate: "2.1.320-rc.1", now: new Date("2026-12-01") }),
    "unknownVersion",
  );
  assert.equal(aiToolUpdateBlocker({ ...base, current: null, now: new Date("2026-12-01") }), null);
});

test("cleanup keeps the active and previous versions and anything a run uses", () => {
  const remove = (input: Partial<Parameters<typeof aiToolVersionsToRemove>[0]>) =>
    aiToolVersionsToRemove({
      installed: ["1.0.1", "1.0.2", "1.0.3"],
      active: "1.0.3",
      previous: "1.0.2",
      bundled: "1.0.0",
      inUse: [],
      ...input,
    });

  assert.deepEqual(remove({}), ["1.0.1"]);
  assert.deepEqual(remove({ inUse: ["1.0.1"] }), []);
  // The image now ships 1.0.2, so an installed copy of it is redundant.
  assert.deepEqual(remove({ bundled: "1.0.2" }), ["1.0.1", "1.0.2"]);
  // Back on the image's version: nothing installed is active, the previous one stays.
  assert.deepEqual(remove({ active: null, previous: "1.0.3" }), ["1.0.1", "1.0.2"]);
});
