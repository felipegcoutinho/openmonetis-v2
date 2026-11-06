import {
  type AiProvider,
  type AiProviderLoginMethod,
  type AiProviderLoginStatus,
  aiProviders,
} from "@openmonetis/domain/ai-providers";
import type {
  AiProviderLoginOutput,
  AiProviderModel,
  AiProviderOutput,
  AiProvidersOutput,
  StartAiProviderLoginInput,
  SubmitAiProviderLoginCodeInput,
  UpdateAiProviderInput,
} from "@openmonetis/validators/ai-providers";
import { badRequest, conflict, notFound, serviceUnavailable } from "../utils/errors";

export type AiProviderLogin = {
  loginId: string;
  provider: AiProvider;
  method: AiProviderLoginMethod;
  status: AiProviderLoginStatus;
  verificationUrl: string | null;
  userCode: string | null;
  expiresAt: string;
};

/** A live subscription sign-in; `email` is `null` when the vendor CLI does not report it. */
export type AiProviderAccount = { email: string | null };

/** The internal AI service, which runs each vendor's own CLI sign-in in the user's home. */
export type AiProvidersGateway = {
  enabled: boolean;
  /** The signed-in account, or `null` when the provider is disconnected. */
  readAccount(userId: string, provider: AiProvider): Promise<AiProviderAccount | null>;
  listModels(userId: string, provider: AiProvider): Promise<AiProviderModel[]>;
  disconnect(userId: string, provider: AiProvider): Promise<void>;
  startLogin(userId: string, provider: AiProvider): Promise<AiProviderLogin>;
  getLogin(userId: string, provider: AiProvider, loginId: string): Promise<AiProviderLogin | null>;
  submitLoginCode(
    userId: string,
    provider: AiProvider,
    loginId: string,
    code: string,
  ): Promise<AiProviderLogin | null>;
};

export type AiProviderConnectionRecord = {
  provider: AiProvider;
  consentedAt: Date;
  preferredModel: string | null;
};

export type AiProvidersRepository = {
  listByUser(userId: string): Promise<AiProviderConnectionRecord[]>;
  saveConsent(userId: string, provider: AiProvider, consentedAt: Date): Promise<void>;
  savePreferredModel(
    userId: string,
    provider: AiProvider,
    preferredModel: string | null,
  ): Promise<boolean>;
  deleteForUser(userId: string, provider: AiProvider): Promise<void>;
};

export function createAiProvidersService(
  repository: AiProvidersRepository,
  gateway: AiProvidersGateway,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());

  function requireEnabled() {
    if (!gateway.enabled) {
      throw serviceUnavailable("AI features are not enabled", "ai_disabled");
    }
  }

  async function reach<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error("AI service request failed", error);
      throw serviceUnavailable("AI service unavailable", "ai_service_unavailable");
    }
  }

  async function describe(
    userId: string,
    provider: AiProvider,
    connection: AiProviderConnectionRecord | undefined,
  ): Promise<AiProviderOutput> {
    const base = { provider, models: [], accountEmail: null };
    if (!connection) {
      return { ...base, status: "disconnected", consentedAt: null, preferredModel: null };
    }
    const known = {
      ...base,
      consentedAt: connection.consentedAt.toISOString(),
      preferredModel: connection.preferredModel,
    };
    try {
      const account = await gateway.readAccount(userId, provider);
      if (!account) return { ...known, status: "disconnected" };
      const models = await gateway.listModels(userId, provider).catch(() => []);
      return { ...known, status: "connected", models, accountEmail: account.email };
    } catch {
      return { ...known, status: "unavailable" };
    }
  }

  async function connectionOf(userId: string, provider: AiProvider) {
    const connections = await repository.listByUser(userId);
    return connections.find((connection) => connection.provider === provider);
  }

  async function requireCatalogModel(userId: string, provider: AiProvider, model: string) {
    const models = await reach(() => gateway.listModels(userId, provider));
    if (!models.some((item) => item.id === model)) {
      throw badRequest("Model not available for this account", "ai_model_unavailable");
    }
  }

  return {
    async list(userId: string): Promise<AiProvidersOutput> {
      const connections = gateway.enabled ? await repository.listByUser(userId) : [];
      const items = await Promise.all(
        aiProviders.map((provider) =>
          gateway.enabled
            ? describe(
                userId,
                provider,
                connections.find((item) => item.provider === provider),
              )
            : describe(userId, provider, undefined),
        ),
      );
      return { enabled: gateway.enabled, items };
    },

    async update(
      userId: string,
      provider: AiProvider,
      input: UpdateAiProviderInput,
    ): Promise<AiProviderOutput> {
      requireEnabled();
      const connection = await connectionOf(userId, provider);
      if (!connection) throw conflict("Connect the AI provider first", "ai_provider_not_connected");
      if (input.preferredModel) await requireCatalogModel(userId, provider, input.preferredModel);
      await repository.savePreferredModel(userId, provider, input.preferredModel);
      return describe(userId, provider, { ...connection, preferredModel: input.preferredModel });
    },

    async startLogin(
      userId: string,
      provider: AiProvider,
      _input: StartAiProviderLoginInput,
    ): Promise<AiProviderLoginOutput> {
      requireEnabled();
      await repository.saveConsent(userId, provider, now());
      return reach(() => gateway.startLogin(userId, provider));
    },

    async getLogin(
      userId: string,
      provider: AiProvider,
      loginId: string,
    ): Promise<AiProviderLoginOutput> {
      requireEnabled();
      const login = await reach(() => gateway.getLogin(userId, provider, loginId));
      if (!login) throw notFound("Sign-in not found", "ai_login_not_found");
      return login;
    },

    async submitLoginCode(
      userId: string,
      provider: AiProvider,
      loginId: string,
      input: SubmitAiProviderLoginCodeInput,
    ): Promise<AiProviderLoginOutput> {
      requireEnabled();
      const login = await reach(() =>
        gateway.submitLoginCode(userId, provider, loginId, input.code),
      );
      if (!login) throw notFound("Sign-in not found", "ai_login_not_found");
      return login;
    },

    async disconnect(userId: string, provider: AiProvider): Promise<AiProviderOutput> {
      requireEnabled();
      await reach(() => gateway.disconnect(userId, provider));
      await repository.deleteForUser(userId, provider);
      return describe(userId, provider, undefined);
    },

    /**
     * Confirms a provider can run a diagnosis (recorded consent and a live subscription sign-in)
     * and resolves the model: the one requested, else the preferred one, else the plan default.
     */
    async prepareRun(userId: string, provider: AiProvider, requestedModel?: string | null) {
      const connection = gateway.enabled ? await connectionOf(userId, provider) : undefined;
      if (!connection || !(await reach(() => gateway.readAccount(userId, provider)))) {
        throw conflict(
          "Connect the AI provider before requesting a diagnosis",
          "ai_provider_not_connected",
        );
      }
      if (requestedModel) {
        await requireCatalogModel(userId, provider, requestedModel);
        return { model: requestedModel };
      }
      // A preferred model the account lost access to falls back to the plan default.
      const preferred = connection.preferredModel;
      const models = preferred ? await reach(() => gateway.listModels(userId, provider)) : [];
      return { model: models.some((item) => item.id === preferred) ? preferred : null };
    },
  };
}

export type AiProvidersService = ReturnType<typeof createAiProvidersService>;
