import assert from "node:assert/strict";
import test from "node:test";
import {
  type CategoriesRepository,
  type CategoryRecord,
  createCategoriesService,
} from "./categories.service";

test("category removal checks ownership and rejects financial references before deleting", async () => {
  const userId = "10000000-0000-4000-8000-000000000001";
  const category: CategoryRecord = {
    id: "20000000-0000-4000-8000-000000000002",
    userId,
    name: "Moradia",
    type: "expense",
    icon: null,
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let referenced = true;
  let deletions = 0;
  const repository = new Proxy(
    {
      findByIdForUser: async (id: string, owner: string) =>
        id === category.id && owner === userId ? category : null,
      hasFinancialReferencesForUser: async (id: string, owner: string) => {
        assert.equal(id, category.id);
        assert.equal(owner, userId);
        return referenced;
      },
      deleteForUser: async (id: string, owner: string) => {
        assert.equal(id, category.id);
        assert.equal(owner, userId);
        deletions++;
        return category;
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as CategoriesRepository;
  const service = createCategoriesService(repository);
  await assert.rejects(service.remove(category.id, userId), { code: "category_in_use" });
  await assert.rejects(service.remove(category.id, "another-user"), { code: "category_not_found" });
  assert.equal(deletions, 0);
  referenced = false;
  assert.deepEqual(await service.remove(category.id, userId), { id: category.id });
  assert.equal(deletions, 1);
});
