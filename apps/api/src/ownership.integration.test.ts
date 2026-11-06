import assert from "node:assert/strict";
import test from "node:test";
import { createTestApiClient } from "./test-support/api-client";
import { withIntegrationDatabase } from "./test-support/integration-database";

test("authenticated users cannot read or mutate foreign financial resources", {
  skip: process.env.OWNERSHIP_INTEGRATION_TEST !== "1",
}, async (t) => {
  await withIntegrationDatabase(async () => {
    const api = await createTestApiClient();
    const owner = await api.register();
    const stranger = await api.register();
    const account = await api.account(owner);
    const resources = [
      { path: "/accounts", id: account.id, method: "PATCH", patch: { name: "Stolen" } },
      {
        path: "/cards",
        input: {
          accountId: account.id,
          name: "Card",
          brand: "visa",
          closingDay: 20,
          dueDay: 25,
          limit: 1000,
        },
        method: "PATCH",
        patch: { name: "Stolen" },
      },
      { path: "/people", input: { name: "Guest" }, method: "PATCH", patch: { name: "Stolen" } },
      {
        path: "/categories",
        input: { name: "Owned", type: "expense" },
        method: "PATCH",
        patch: { name: "Stolen" },
      },
      { path: "/tags", input: { name: "Owned" }, method: "PATCH", patch: { name: "Stolen" } },
      {
        path: "/budgets",
        input: { categoryId: owner.expenseCategoryId, period: "2020-01", amount: 100 },
        method: "PATCH",
        patch: { amount: 1 },
      },
      {
        path: "/goals",
        input: {
          name: "Reserve",
          trackingType: "manual",
          targetAmount: 100,
          currentAmount: 10,
          targetDate: null,
        },
        method: "PATCH",
        patch: { name: "Stolen" },
      },
      {
        path: "/notes",
        input: { title: "Owned", kind: "text", content: "Private" },
        method: "PUT",
        patch: { expectedVersion: 1, title: "Stolen", kind: "text", content: "Changed" },
      },
    ];
    for (const resource of resources)
      await t.test(
        `${resource.path} rejects foreign writes and keeps the original resource`,
        async () => {
          const record = resource.id
            ? { id: resource.id }
            : await api.data<{ id: string }>(
                await api.request(resource.path, owner, "POST", resource.input),
                201,
              );
          const path = `${resource.path}/${record.id}`;
          const before = await api.request(path, owner);
          const beforeText = before.status === 200 ? await before.text() : null;
          if (beforeText) await api.error(await api.request(path, stranger), 404);
          await api.error(await api.request(path, stranger, resource.method, resource.patch), 404);
          await api.error(
            await api.request(
              resource.path === "/notes" ? `${path}?expectedVersion=1` : path,
              stranger,
              "DELETE",
            ),
            404,
          );
          if (beforeText) assert.equal(await (await api.request(path, owner)).text(), beforeText);
        },
      );
    await t.test(
      "foreign accounts and categories cannot be linked to cards, goals or budgets",
      async () => {
        await api.error(
          await api.request("/cards", stranger, "POST", {
            accountId: account.id,
            name: "Card",
            brand: "visa",
            closingDay: 20,
            dueDay: 25,
            limit: 100,
          }),
          404,
        );
        await api.error(
          await api.request("/goals", stranger, "POST", {
            name: "Reserve",
            trackingType: "account",
            accountId: account.id,
            targetAmount: 100,
            targetDate: null,
          }),
          404,
        );
        await api.error(
          await api.request("/budgets", stranger, "POST", {
            categoryId: owner.expenseCategoryId,
            period: "2020-01",
            amount: 10,
          }),
          404,
        );
      },
    );
    await t.test(
      "AI diagnoses, chats, data sharing and tools stay private to their owner",
      async () => {
        const { db, aiChatMessages, aiChats, aiDataSharing, aiDiagnoses } = await import(
          "@openmonetis/db"
        );
        const { calculateFinancialHealth } = await import("@openmonetis/domain/ai-diagnoses");
        const { eq } = await import("drizzle-orm");
        const health = calculateFinancialHealth({
          history: [{ period: "2020-01", income: 1_000, expenses: 700 }],
          totalBalance: 2_000,
          expenseCategories: [],
          attention: { critical: 0, warning: 0 },
        });
        const completedAt = new Date();
        const [diagnosis] = await db
          .insert(aiDiagnoses)
          .values({
            userId: owner.id,
            period: "2020-01",
            provider: "claude",
            voice: "sarcastic",
            status: "completed",
            health,
            result: {
              headline: "Owned",
              summary: "Private",
              sections: [],
              charts: [],
              actions: [],
            },
            completedAt,
          })
          .returning();
        const [chat] = await db
          .insert(aiChats)
          .values({ userId: owner.id, title: "Owned", period: "2020-01", provider: "claude" })
          .returning();
        await db.insert(aiChatMessages).values([
          {
            chatId: chat.id,
            userId: owner.id,
            role: "user",
            content: "Private question",
            status: "completed",
            completedAt,
          },
          {
            chatId: chat.id,
            userId: owner.id,
            role: "assistant",
            content: "Private answer",
            status: "completed",
            provider: "claude",
            completedAt,
          },
        ]);
        await db.insert(aiDataSharing).values({ userId: owner.id, scopes: ["transactions"] });

        const diagnosisPath = `/ai-diagnoses/${diagnosis.id}`;
        const chatPath = `/ai-chats/${chat.id}`;
        const ownerDiagnosis = await (await api.request(diagnosisPath, owner)).text();
        const ownerChat = await (await api.request(chatPath, owner)).text();
        assert.match(ownerDiagnosis, /Private/);
        assert.match(ownerChat, /Private answer/);

        await api.error(await api.request(diagnosisPath, stranger), 404);
        await api.error(await api.request(`${diagnosisPath}/cancel`, stranger, "POST"), 404);
        await api.error(await api.request(diagnosisPath, stranger, "DELETE"), 404);
        await api.error(await api.request(chatPath, stranger), 404);
        await api.error(await api.request(chatPath, stranger, "PATCH", { title: "Stolen" }), 404);
        await api.error(await api.request(chatPath, stranger, "DELETE"), 404);
        await api.error(
          await api.request(`${chatPath}/messages`, stranger, "POST", {
            content: "Leak it",
            provider: "claude",
          }),
          404,
        );
        await api.error(
          await api.request(`${chatPath}/regenerate`, stranger, "POST", { provider: "claude" }),
          404,
        );

        const strangerDiagnoses = await api.data<{ items: Array<{ id: string }> }>(
          await api.request("/ai-diagnoses", stranger),
        );
        const strangerChats = await api.data<{ items: Array<{ id: string }> }>(
          await api.request("/ai-chats", stranger),
        );
        assert.deepEqual(strangerDiagnoses.items, []);
        assert.deepEqual(strangerChats.items, []);

        // Another person's sharing choices and history deletion never reach the owner's data.
        const strangerSharing = await api.data<{ scopes: string[] }>(
          await api.request("/ai-data-sharing", stranger),
        );
        assert.deepEqual(strangerSharing.scopes, []);
        await api.data(await api.request("/ai-data-sharing", stranger, "PUT", { scopes: [] }));
        await api.data(await api.request("/ai-data-sharing/history", stranger, "DELETE"));
        const [ownerSharing] = await db
          .select()
          .from(aiDataSharing)
          .where(eq(aiDataSharing.userId, owner.id));
        assert.deepEqual(ownerSharing?.scopes, ["transactions"]);
        assert.equal(await (await api.request(diagnosisPath, owner)).text(), ownerDiagnosis);
        assert.equal(await (await api.request(chatPath, owner)).text(), ownerChat);

        // Only the first account administers the AI service's CLI builds.
        await api.error(await api.request("/ai-tools/events", stranger), 403, "ai_tools_forbidden");
        await api.error(
          await api.request("/ai-tools/claude/installs", stranger, "POST", { version: "9.9.9" }),
          403,
          "ai_tools_forbidden",
        );
        const strangerTools = await api.data<{ allowed: boolean }>(
          await api.request("/ai-tools", stranger),
        );
        assert.equal(strangerTools.allowed, false);
      },
    );
  });
});
