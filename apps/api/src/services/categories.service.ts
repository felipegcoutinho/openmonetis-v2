import {
  type CategoryCreateDraft,
  type CategoryType,
  canChangeCategoryType,
  createCategoryDraft,
  createDefaultCategoryDrafts,
} from "@openmonetis/domain/categories";
import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
  UpdateCategoryInput,
} from "@openmonetis/validators/categories";
import { badRequest, notFound } from "../utils/errors";

export type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};
type CategoryCreateRecord = Omit<CategoryRecord, "id" | "createdAt" | "updatedAt">;
type CategoryUpdateRecord = Partial<Pick<CategoryRecord, "name" | "type" | "icon">>;
export type CategoriesRepository = {
  insertDefaults(data: CategoryCreateDraft[]): Promise<void>;
  insert(data: CategoryCreateRecord): Promise<CategoryRecord>;
  listByUser(userId: string): Promise<CategoryRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<CategoryRecord | null>;
  findSystemByNameForUser(name: string, userId: string): Promise<CategoryRecord | null>;
  updateForUser(
    id: string,
    userId: string,
    data: CategoryUpdateRecord,
  ): Promise<CategoryRecord | null>;
  deleteForUser(id: string, userId: string): Promise<CategoryRecord | null>;
  hasFinancialReferencesForUser(id: string, userId: string): Promise<boolean>;
};

function toOutput(category: CategoryRecord): CategoryOutput {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    icon: category.icon,
    isSystem: category.isSystem,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function createCategoriesService(repository: CategoriesRepository) {
  async function editableCategory(id: string, userId: string) {
    const category = await repository.findByIdForUser(id, userId);
    if (!category || category.isSystem) throw notFound("Category not found", "category_not_found");
    return category;
  }
  async function assertTypeChange(
    category: CategoryRecord,
    nextType: CategoryType,
    userId: string,
  ) {
    if (category.type === nextType) return;
    const hasFinancialReferences = await repository.hasFinancialReferencesForUser(
      category.id,
      userId,
    );
    if (
      !canChangeCategoryType({
        currentType: category.type,
        nextType,
        hasFinancialReferences,
      })
    ) {
      throw badRequest("The type of a category in use cannot be changed", "category_type_in_use");
    }
  }
  return {
    async seedDefaults(userId: string) {
      await repository.insertDefaults(createDefaultCategoryDrafts(userId));
    },
    async create(input: CreateCategoryInput, userId: string) {
      return toOutput(
        await repository.insert(
          createCategoryDraft({
            userId,
            name: input.name,
            type: input.type,
            icon: input.icon ?? null,
          }),
        ),
      );
    },
    async list(userId: string) {
      return (await repository.listByUser(userId)).map(toOutput);
    },
    async get(id: string, userId: string) {
      const category = await repository.findByIdForUser(id, userId);
      if (!category) throw notFound("Category not found", "category_not_found");
      return toOutput(category);
    },
    async replace(id: string, userId: string, input: ReplaceCategoryInput) {
      const current = await editableCategory(id, userId);
      await assertTypeChange(current, input.type, userId);
      const category = await repository.updateForUser(id, userId, {
        name: input.name.trim(),
        type: input.type,
        icon: input.icon?.trim() || null,
      });
      if (!category) throw notFound("Category not found", "category_not_found");
      return toOutput(category);
    },
    async update(id: string, userId: string, input: UpdateCategoryInput) {
      const current = await editableCategory(id, userId);
      if (input.type !== undefined) await assertTypeChange(current, input.type, userId);
      const values: CategoryUpdateRecord = {};
      if (input.name !== undefined) values.name = input.name.trim();
      if (input.type !== undefined) values.type = input.type;
      if (input.icon !== undefined) values.icon = input.icon?.trim() || null;
      const category = await repository.updateForUser(id, userId, values);
      if (!category) throw notFound("Category not found", "category_not_found");
      return toOutput(category);
    },
    async remove(id: string, userId: string) {
      await editableCategory(id, userId);
      if (await repository.hasFinancialReferencesForUser(id, userId))
        throw badRequest("Category has financial references", "category_in_use");
      const category = await repository.deleteForUser(id, userId);
      if (!category) throw notFound("Category not found", "category_not_found");
      return { id: category.id };
    },
  };
}
export type CategoriesService = ReturnType<typeof createCategoriesService>;
