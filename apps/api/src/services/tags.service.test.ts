import assert from "node:assert/strict";
import test from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  CreateTagInputSchema,
  TagIdsSchema,
  TagsReportOutputSchema,
  UpdateTagInputSchema,
} from "@openmonetis/validators/tags";
import { errorHandler } from "../middlewares/errors";
import { createTagsRoute } from "../routes/tags";
import type { ApiVariables } from "../types/context";
import { createTagsService, type TagRecord, type TagsRepository } from "./tags.service";

const id = "10000000-0000-4000-8000-000000000001";
const owner = "20000000-0000-4000-8000-000000000002";
function fixture() {
  const rows: TagRecord[] = [];
  const repository: TagsRepository = {
    async listForUser(userId) {
      return rows.filter((row) => row.userId === userId);
    },
    async createForUser(userId, name, nameKey, color) {
      if (rows.some((row) => row.userId === userId && row.nameKey === nameKey)) return null;
      const row = {
        id,
        userId,
        name,
        nameKey,
        status: "active" as const,
        color,
        createdAt: new Date("2026-10-01"),
        updatedAt: new Date("2026-10-01"),
      };
      rows.push(row);
      return row;
    },
    async updateForUser(tagId, userId, changes) {
      const row = rows.find((row) => row.id === tagId && row.userId === userId);
      if (row) Object.assign(row, changes);
      return row ?? null;
    },
    async deleteForUser(tagId, userId) {
      const index = rows.findIndex((row) => row.id === tagId && row.userId === userId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
  };
  return createTagsService(repository, async (userId, period) => {
    assert.equal(userId, owner);
    assert.equal(period, "2026-10");
    return [
      { id: "expense", type: "expense", origin: "regular", amount: -12.5, tagIds: [id] },
      { id: "outgoing", type: "transfer", origin: "regular", amount: -287.15, tagIds: [id] },
      { id: "incoming", type: "transfer", origin: "regular", amount: 287.15, tagIds: [id] },
    ];
  });
}
test("tag contracts reject duplicate IDs, excessive assignments and empty names", () => {
  assert.equal(TagIdsSchema.safeParse([id, id]).success, false);
  assert.equal(TagIdsSchema.safeParse(Array(21).fill(id)).success, false);
  assert.equal(CreateTagInputSchema.safeParse({ name: "   " }).success, false);
});
test("tag use cases enforce owner isolation, uniqueness and omit internal fields", async () => {
  const service = fixture();
  const tag = await service.create({ name: "  Viagem   Japão  ", color: "blue" }, owner);
  assert.equal(tag.name, "Viagem Japão");
  assert.equal(tag.color, "blue");
  assert.equal("userId" in tag, false);
  assert.equal("nameKey" in tag, false);
  await assert.rejects(() => service.create({ name: "viagem japão", color: "neutral" }, owner), {
    code: "tag_name_conflict",
  });
  assert.deepEqual(await service.list("another-user"), []);
  await assert.rejects(() => service.update(id, { name: "Outra" }, "another-user"), {
    code: "tag_not_found",
  });
  await assert.rejects(() => service.remove(id, "another-user"), { code: "tag_not_found" });
  assert.equal((await service.report("2026-10", owner)).items[0].expenses, 12.5);
  await service.remove(id, owner);
  assert.deepEqual(await service.list(owner), []);
});
test("tags can be deactivated and reactivated without changing their name", async () => {
  const service = fixture();
  const tag = await service.create({ name: "Viagem", color: "neutral" }, owner);
  assert.equal(tag.status, "active");
  const inactive = await service.update(id, { status: "inactive" }, owner);
  assert.equal(inactive.status, "inactive");
  assert.equal(inactive.name, "Viagem");
  assert.equal((await service.update(id, { status: "active" }, owner)).status, "active");
  assert.equal(UpdateTagInputSchema.safeParse({}).success, false);
  assert.equal(UpdateTagInputSchema.safeParse({ status: "archived" }).success, false);
  assert.equal((await service.update(id, { color: "green" }, owner)).color, "green");
  assert.equal(CreateTagInputSchema.parse({ name: "Casa" }).color, "neutral");
  assert.equal(CreateTagInputSchema.safeParse({ name: "Casa", color: "#ff0000" }).success, false);
});
test("tag HTTP routes validate input, publish envelopes and expose the report", async () => {
  const app = new OpenAPIHono<{ Variables: ApiVariables }>();
  app.use("*", async (c, next) => {
    c.set("userId", owner);
    await next();
  });
  app.route("/tags", createTagsRoute(fixture()));
  app.onError(errorHandler);
  const post = (body: unknown) =>
    app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await post({ name: " " })).status, 400);
  const created = await post({ name: "Viagem" });
  assert.equal(created.status, 201);
  const payload = await created.json();
  assert.equal(payload.error, null);
  assert.equal(payload.data.name, "Viagem");
  assert.equal((await post({ name: "viagem" })).status, 409);
  assert.equal((await app.request("/tags/report?period=invalid")).status, 400);
  const report = await app.request("/tags/report?period=2026-10");
  assert.equal(report.status, 200);
  const reportData = TagsReportOutputSchema.parse((await report.json()).data);
  assert.deepEqual(reportData, {
    period: "2026-10",
    items: [
      {
        tagId: id,
        income: 0,
        expenses: 12.5,
        transfers: 287.15,
        balance: -12.5,
        transactionCount: 2,
      },
    ],
  });
});
