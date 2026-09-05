import {
  createDefaultUserPreferences,
  normalizeUserPreferences,
  type UserPreferences,
  type UserPreferencesRecord,
} from "@openmonetis/domain/preferences";
import type {
  UpdateUserPreferencesInput,
  UserPreferencesOutput,
} from "@openmonetis/validators/preferences";
import { badRequest } from "../utils/errors";

export type PreferencesRepository = {
  findByUserId(userId: string): Promise<UserPreferencesRecord | null>;
  isActiveAccountForUser(accountId: string, userId: string): Promise<boolean>;
  isActiveCardForUser(cardId: string, userId: string): Promise<boolean>;
  saveForUser(userId: string, preferences: UserPreferences): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
};

export function createPreferencesService(repository: PreferencesRepository) {
  async function get(userId: string): Promise<UserPreferencesOutput> {
    return normalizeUserPreferences(await repository.findByUserId(userId));
  }

  return {
    get,

    getDefaults(): UserPreferencesOutput {
      return createDefaultUserPreferences();
    },

    async update(
      input: UpdateUserPreferencesInput,
      userId: string,
    ): Promise<UserPreferencesOutput> {
      const [accountIsAvailable, cardIsAvailable, current] = await Promise.all([
        input.defaultAccountId
          ? repository.isActiveAccountForUser(input.defaultAccountId, userId)
          : Promise.resolve(true),
        input.defaultCardId
          ? repository.isActiveCardForUser(input.defaultCardId, userId)
          : Promise.resolve(true),
        get(userId),
      ]);

      if (!accountIsAvailable) {
        throw badRequest("Default account is unavailable", "default_account_unavailable");
      }
      if (!cardIsAvailable) {
        throw badRequest("Default card is unavailable", "default_card_unavailable");
      }

      const preferences = normalizeUserPreferences({ ...current, ...input });
      await repository.saveForUser(userId, preferences);
      return preferences;
    },

    async reset(userId: string): Promise<UserPreferencesOutput> {
      await repository.deleteForUser(userId);
      return createDefaultUserPreferences();
    },
  };
}

export type PreferencesService = ReturnType<typeof createPreferencesService>;
