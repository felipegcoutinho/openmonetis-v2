import { serve } from "@hono/node-server";
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { requireAuth } from "./middlewares/auth";
import { createRequireDeviceToken } from "./middlewares/device-auth";
import { errorHandler, notFoundHandler } from "./middlewares/errors";
import { createMutationRateLimit, privateCache, securityHeaders } from "./middlewares/security";
import { accountsRepository, findAccountByIdForUser } from "./repositories/accounts.repository";
import { attachmentsRepository } from "./repositories/attachments.repository";
import { billsRepository } from "./repositories/bills.repository";
import { budgetsRepository } from "./repositories/budgets.repository";
import { cardsRepository, findCardByIdForUser } from "./repositories/cards.repository";
import {
  categoriesRepository,
  findCategoryByIdForUser,
  findSystemCategoryByNameForUser,
  listCategoriesByIdsForUser,
} from "./repositories/categories.repository";
import { categoryTrendsRepository } from "./repositories/category-trends.repository";
import { dashboardRepository } from "./repositories/dashboard.repository";
import { deviceTokensRepository } from "./repositories/device-tokens.repository";
import { establishmentsRepository } from "./repositories/establishments.repository";
import { externalExpensesRepository } from "./repositories/external-expenses.repository";
import { goalsRepository } from "./repositories/goals.repository";
import { inboxRepository } from "./repositories/inbox.repository";
import { inboxRulesRepository } from "./repositories/inbox-rules.repository";
import { installmentsRepository } from "./repositories/installments.repository";
import { invoicesRepository } from "./repositories/invoices.repository";
import { notesRepository } from "./repositories/notes.repository";
import { notificationsRepository } from "./repositories/notifications.repository";
import {
  findAdminPersonByUserId,
  findPersonByIdForUser,
  listPeopleByIdsForUser,
  peopleRepository,
} from "./repositories/people.repository";
import { personConnectionsRepository } from "./repositories/person-connections.repository";
import { personSettlementsRepository } from "./repositories/person-settlements.repository";
import { preferencesRepository } from "./repositories/preferences.repository";
import { recurringExpensesRepository } from "./repositories/recurring-expenses.repository";
import { applicationVersion, releasesRepository } from "./repositories/releases.repository";
import { settingsRepository } from "./repositories/settings.repository";
import * as transactionsRepository from "./repositories/transactions.repository";
import { createAccountsRoute } from "./routes/accounts";
import { createAttachmentsRoute } from "./routes/attachments";
import { createBillsRoute } from "./routes/bills";
import { createBudgetsRoute } from "./routes/budgets";
import { createCardsRoute } from "./routes/cards";
import { createCategoriesRoute } from "./routes/categories";
import { createCategoryTrendsRoute } from "./routes/category-trends";
import { createDashboardRoute } from "./routes/dashboard";
import { createCompanionDeviceRoute, createDeviceTokensRoute } from "./routes/device-tokens";
import { createEstablishmentsRoute } from "./routes/establishments";
import { createExternalExpensesRoute } from "./routes/external-expenses";
import { createGoalsRoute } from "./routes/goals";
import { createCompanionInboxRoute, createInboxRoute } from "./routes/inbox";
import { createInboxRulesRoute } from "./routes/inbox-rules";
import { createInstallmentsRoute } from "./routes/installments";
import { createInvoicesRoute } from "./routes/invoices";
import { createNotesRoute } from "./routes/notes";
import { createNotificationsRoute } from "./routes/notifications";
import { createPeopleRoute } from "./routes/people";
import { createPersonConnectionsRoute } from "./routes/person-connections";
import { createPersonSettlementsRoute } from "./routes/person-settlements";
import { createPreferencesRoute } from "./routes/preferences";
import { createRecurringExpensesRoute } from "./routes/recurring-expenses";
import { createReleasesRoute } from "./routes/releases";
import { createSettingsRoute } from "./routes/settings";
import { createTransactionsRoute } from "./routes/transactions";
import { createAccountsService } from "./services/accounts.service";
import { createAttachmentsService } from "./services/attachments.service";
import { createBillsService } from "./services/bills.service";
import { createBudgetsService } from "./services/budgets.service";
import { createCardsService } from "./services/cards.service";
import { createCategoriesService } from "./services/categories.service";
import { createCategoryTrendsService } from "./services/category-trends.service";
import { createDashboardService } from "./services/dashboard.service";
import { createDeviceTokensService } from "./services/device-tokens.service";
import { createEstablishmentsService } from "./services/establishments.service";
import {
  createExternalExpensesService,
  synchronizeRecurringExternalExpenses,
} from "./services/external-expenses.service";
import { createGoalsService } from "./services/goals.service";
import { createInboxService } from "./services/inbox.service";
import { createInboxRulesService } from "./services/inbox-rules.service";
import { createInstallmentsService } from "./services/installments.service";
import { createInvoicesService } from "./services/invoices.service";
import { createNotesService } from "./services/notes.service";
import { createNotificationsService } from "./services/notifications.service";
import { createPeopleService } from "./services/people.service";
import { createPersonConnectionsService } from "./services/person-connections.service";
import { createPersonSettlementsService } from "./services/person-settlements.service";
import { createPreferencesService } from "./services/preferences.service";
import { createRecurringExpensesService } from "./services/recurring-expenses.service";
import { createReleasesService } from "./services/releases.service";
import { createSettingsService } from "./services/settings.service";
import { createTransactionsService } from "./services/transactions.service";
import type { ApiVariables } from "./types/context";
import { assertProductionSecret, getRequiredProductionEnv, parseCsvEnv } from "./utils/env";
import { logoDevGateway } from "./utils/logo-dev";
import { validationHook } from "./utils/openapi";
import { attachmentStorage } from "./utils/storage";

const app = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
app.openAPIRegistry.registerComponent("securitySchemes", "deviceBearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "OpenMonetis device token",
  description: "Revocable credential created by an authenticated OpenMonetis web session.",
});
app.openAPIRegistry.registerComponent("securitySchemes", "sessionCookie", {
  type: "apiKey",
  in: "cookie",
  name: "better-auth.session_token",
  description: "Better Auth session cookie used by local HTTP development.",
});
app.openAPIRegistry.registerComponent("securitySchemes", "secureSessionCookie", {
  type: "apiKey",
  in: "cookie",
  name: "__Secure-better-auth.session_token",
  description: "Better Auth session cookie used by HTTPS deployments.",
});
const accountsService = createAccountsService(accountsRepository);
const accountsRoute = createAccountsRoute(accountsService);
const cardsRoute = createCardsRoute(createCardsService(cardsRepository));
const budgetsService = createBudgetsService(budgetsRepository, categoriesRepository);
const budgetsRoute = createBudgetsRoute(budgetsService);
const goalsRoute = createGoalsRoute(createGoalsService(goalsRepository, accountsService));
const billsService = createBillsService(billsRepository);
const billsRoute = createBillsRoute(billsService);
const categoriesRoute = createCategoriesRoute(createCategoriesService(categoriesRepository));
const categoryTrendsRoute = createCategoryTrendsRoute(
  createCategoryTrendsService(categoryTrendsRepository),
);
const installmentsRoute = createInstallmentsRoute(
  createInstallmentsService(installmentsRepository),
);
const invoicesService = createInvoicesService(invoicesRepository);
const invoicesRoute = createInvoicesRoute(invoicesService);
const notesService = createNotesService(notesRepository);
const notesRoute = createNotesRoute(notesService);
const attachmentsService = createAttachmentsService(attachmentsRepository, attachmentStorage);
const attachmentsRoute = createAttachmentsRoute(attachmentsService);
const transactionsService = createTransactionsService(
  {
    ...transactionsRepository,
    findAccountByIdForUser,
    findAdminPersonByUserId,
    findCardByIdForUser,
    findCategoryByIdForUser,
    findPersonByIdForUser,
    findSystemCategoryByNameForUser,
    getAccountBalanceSnapshotForUser: accountsService.getBalanceSnapshot,
    listCategoriesByIdsForUser,
    listPeopleByIdsForUser,
  },
  attachmentsService,
  {
    synchronize: (ownerUserId, period) =>
      synchronizeRecurringExternalExpenses(externalExpensesRepository, { ownerUserId, period }),
  },
);
const transactionsRoute = createTransactionsRoute(transactionsService);
const peopleRoute = createPeopleRoute(
  createPeopleService(peopleRepository, { list: transactionsService.listTransactions }),
);
const personConnectionSecret =
  assertProductionSecret("PERSON_CONNECTION_SECRET", [
    "development-person-connection-secret-change-me",
  ]) ?? "development-person-connection-secret-change-me";
const personConnectionsService = createPersonConnectionsService(personConnectionsRepository, {
  secret: personConnectionSecret,
  synchronizeRecurringExternalExpenses: (ownerUserId, period) =>
    synchronizeRecurringExternalExpenses(externalExpensesRepository, { ownerUserId, period }),
});
const personConnectionsRoute = createPersonConnectionsRoute(personConnectionsService);
const personSettlementsRoute = createPersonSettlementsRoute(
  createPersonSettlementsService(personSettlementsRepository),
);
const externalExpensesService = createExternalExpensesService(externalExpensesRepository, {
  transactionCreator: transactionsService,
  buildEstablishmentLogoUrl: logoDevGateway.buildLogoUrl,
});
const externalExpensesRoute = createExternalExpensesRoute(externalExpensesService);
const recurringExpensesRoute = createRecurringExpensesRoute(
  createRecurringExpensesService(recurringExpensesRepository, undefined, {
    synchronize: (ownerUserId, period) =>
      synchronizeRecurringExternalExpenses(externalExpensesRepository, { ownerUserId, period }),
  }),
);
const releasesRoute = createReleasesRoute(createReleasesService(releasesRepository));
const establishmentsRoute = createEstablishmentsRoute(
  createEstablishmentsService(establishmentsRepository, logoDevGateway),
);
const dashboardRoute = createDashboardRoute(
  createDashboardService(dashboardRepository, accountsService),
);
const settingsRoute = createSettingsRoute(
  createSettingsService(settingsRepository, attachmentStorage),
);
const preferencesService = createPreferencesService(preferencesRepository);
const preferencesRoute = createPreferencesRoute(preferencesService);
const deviceTokenSecret =
  assertProductionSecret("DEVICE_TOKEN_SECRET", ["development-device-token-secret-change-me"]) ??
  "development-device-token-secret-change-me";
const deviceTokensService = createDeviceTokensService(deviceTokensRepository, {
  secret: deviceTokenSecret,
});
const deviceTokensRoute = createDeviceTokensRoute(deviceTokensService);
const companionDeviceRoute = createCompanionDeviceRoute();
const inboxService = createInboxService(inboxRepository, {
  transactionCreator: transactionsService,
  rulesRepository: inboxRulesRepository,
});
const inboxRoute = createInboxRoute(inboxService);
const inboxRulesRoute = createInboxRulesRoute(createInboxRulesService(inboxRulesRepository));
const companionInboxRoute = createCompanionInboxRoute(inboxService);
const notificationsRoute = createNotificationsRoute(
  createNotificationsService(
    notificationsRepository,
    {
      bills: billsService,
      budgets: budgetsService,
      inbox: inboxService,
      invoices: invoicesService,
      externalExpenses: externalExpensesService,
      notes: notesService,
    },
    preferencesService,
  ),
);
const requireDeviceToken = createRequireDeviceToken(deviceTokensService);

const corsOrigins = parseCsvEnv(getRequiredProductionEnv("CORS_ORIGIN", "http://localhost:7002"));

if (corsOrigins.includes("*")) {
  throw new Error("CORS_ORIGIN cannot include wildcard origins when credentials are enabled");
}

app.use("*", securityHeaders);

app.use(
  "*",
  cors({
    origin: corsOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use("/api/auth/*", privateCache);
app.use("/accounts", privateCache);
app.use("/accounts/*", privateCache);
app.use("/accounts", requireAuth);
app.use("/accounts/*", requireAuth);
app.use("/cards", privateCache);
app.use("/cards/*", privateCache);
app.use("/cards", requireAuth);
app.use("/cards/*", requireAuth);
app.use("/budgets", privateCache);
app.use("/budgets/*", privateCache);
app.use("/budgets", requireAuth);
app.use("/budgets/*", requireAuth);
app.use("/goals", privateCache);
app.use("/goals/*", privateCache);
app.use("/goals", requireAuth);
app.use("/goals/*", requireAuth);
app.use("/bills", privateCache);
app.use("/bills/*", privateCache);
app.use("/bills", requireAuth);
app.use("/bills/*", requireAuth);
app.use("/categories", privateCache);
app.use("/categories/*", privateCache);
app.use("/categories", requireAuth);
app.use("/categories/*", requireAuth);
app.use("/people", privateCache);
app.use("/people/*", privateCache);
app.use("/people", requireAuth);
app.use("/people/*", requireAuth);
app.use("/person-settlements", privateCache);
app.use("/person-settlements/*", privateCache);
app.use("/person-settlements", requireAuth);
app.use("/person-settlements/*", requireAuth);
app.use("/person-connections", privateCache);
app.use("/person-connections/*", privateCache);
app.use("/person-connections", requireAuth);
app.use("/person-connections/*", requireAuth);
app.use(
  "/person-connections/*",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 10,
    key: (context) => `connection:${context.get("userId")}`,
  }),
);
app.use("/external-expenses", privateCache);
app.use("/external-expenses/*", privateCache);
app.use("/external-expenses", requireAuth);
app.use("/external-expenses/*", requireAuth);
app.use(
  "/external-expenses",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 30,
    key: (context) => `external-expenses:${context.get("userId")}`,
  }),
);
app.use(
  "/external-expenses/*",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 30,
    key: (context) => `external-expenses:${context.get("userId")}`,
  }),
);
app.use("/recurring-expenses", privateCache);
app.use("/recurring-expenses/*", privateCache);
app.use("/recurring-expenses", requireAuth);
app.use("/recurring-expenses/*", requireAuth);
app.use("/notes", privateCache);
app.use("/notes/*", privateCache);
app.use("/notes", requireAuth);
app.use("/notes/*", requireAuth);
app.use("/transactions", privateCache);
app.use("/transactions/*", privateCache);
app.use("/transactions", requireAuth);
app.use("/transactions/*", requireAuth);
app.use("/dashboard", privateCache);
app.use("/dashboard/*", privateCache);
app.use("/dashboard", requireAuth);
app.use("/dashboard/*", requireAuth);
app.use("/invoices", privateCache);
app.use("/invoices/*", privateCache);
app.use("/invoices", requireAuth);
app.use("/invoices/*", requireAuth);
app.use("/establishments", privateCache);
app.use("/establishments/*", privateCache);
app.use("/establishments", requireAuth);
app.use("/establishments/*", requireAuth);
app.use("/attachments", privateCache);
app.use("/attachments/*", privateCache);
app.use("/attachments", requireAuth);
app.use("/attachments/*", requireAuth);
app.use("/reports/*", privateCache);
app.use("/reports/*", requireAuth);
app.use("/settings", privateCache);
app.use("/settings/*", privateCache);
app.use("/settings", requireAuth);
app.use("/settings/*", requireAuth);
app.use(
  "/settings/*",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 5,
    key: (context) => `settings:${context.get("userId")}`,
  }),
);
app.use("/preferences", privateCache);
app.use("/preferences/*", privateCache);
app.use("/preferences", requireAuth);
app.use("/preferences/*", requireAuth);
app.use("/device-tokens", privateCache);
app.use("/device-tokens/*", privateCache);
app.use("/device-tokens", requireAuth);
app.use("/device-tokens/*", requireAuth);
app.use(
  "/device-tokens",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 5,
    key: (context) => `user:${context.get("userId")}`,
  }),
);
app.use(
  "/device-tokens/*",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 5,
    key: (context) => `user:${context.get("userId")}`,
  }),
);
app.use("/inbox", privateCache);
app.use("/inbox/*", privateCache);
app.use("/inbox", requireAuth);
app.use("/inbox/*", requireAuth);
app.use("/inbox-rules", privateCache);
app.use("/inbox-rules/*", privateCache);
app.use("/inbox-rules", requireAuth);
app.use("/inbox-rules/*", requireAuth);
app.use(
  "/inbox-rules",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 30,
    key: (context) => `inbox-rules:${context.get("userId")}`,
  }),
);
app.use(
  "/inbox-rules/*",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 30,
    key: (context) => `inbox-rules:${context.get("userId")}`,
  }),
);
app.use("/notifications", privateCache);
app.use("/notifications/*", privateCache);
app.use("/notifications", requireAuth);
app.use("/notifications/*", requireAuth);
app.use("/releases", privateCache);
app.use("/releases/*", privateCache);
app.use("/releases", requireAuth);
app.use("/releases/*", requireAuth);
app.use("/api/auth/device/verify", privateCache);
app.use("/api/inbox", privateCache);
app.use("/api/inbox/*", privateCache);
app.use(
  "/api/inbox",
  bodyLimit({
    maxSize: 16 * 1024,
    onError: (context) => context.json({ error: "Conteúdo muito grande" }, 413),
  }),
);
app.use(
  "/api/inbox/batch",
  bodyLimit({
    maxSize: 256 * 1024,
    onError: (context) => context.json({ error: "Conteúdo muito grande" }, 413),
  }),
);
app.use("/api/auth/device/verify", requireDeviceToken);
app.use(
  "/api/auth/device/verify",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 20,
    key: (context) => `device:${context.get("deviceTokenId")}`,
    onLimit: (context) =>
      context.json({ valid: false as const, error: "Muitas solicitações" }, 429),
  }),
);
app.use("/api/inbox", requireDeviceToken);
app.use("/api/inbox/*", requireDeviceToken);
app.use(
  "/api/inbox",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 100,
    key: (context) => `device:${context.get("deviceTokenId")}`,
    onLimit: (context) => context.json({ error: "Muitas solicitações" }, 429),
  }),
);
app.use(
  "/api/inbox/batch",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 20,
    key: (context) => `device:${context.get("deviceTokenId")}`,
    onLimit: (context) => context.json({ error: "Muitas solicitações" }, 429),
  }),
);

app.use(
  "*",
  createMutationRateLimit({
    windowMs: 60_000,
    max: 120,
    key: (context) => {
      const userId = context.get("userId");
      return userId ? `user:${userId}` : null;
    },
  }),
);

app.use("/api/auth/*", async (context, next) => {
  if (
    context.req.path.startsWith("/api/auth/device/") ||
    !["GET", "POST"].includes(context.req.method)
  ) {
    await next();
    return;
  }
  return auth.handler(context.req.raw);
});

app.route("/api/auth/device", companionDeviceRoute);
app.route("/accounts", accountsRoute);
app.route("/cards", cardsRoute);
app.route("/budgets", budgetsRoute);
app.route("/goals", goalsRoute);
app.route("/bills", billsRoute);
app.route("/categories", categoriesRoute);
app.route("/people", peopleRoute);
app.route("/person-connections", personConnectionsRoute);
app.route("/person-settlements", personSettlementsRoute);
app.route("/external-expenses", externalExpensesRoute);
app.route("/notes", notesRoute);
app.route("/recurring-expenses", recurringExpensesRoute);
app.route("/transactions", transactionsRoute);
app.route("/dashboard", dashboardRoute);
app.route("/invoices", invoicesRoute);
app.route("/establishments", establishmentsRoute);
app.route("/attachments", attachmentsRoute);
app.route("/reports/category-trends", categoryTrendsRoute);
app.route("/reports/installments", installmentsRoute);
app.route("/settings", settingsRoute);
app.route("/preferences", preferencesRoute);
app.route("/device-tokens", deviceTokensRoute);
app.route("/inbox", inboxRoute);
app.route("/inbox-rules", inboxRulesRoute);
app.route("/notifications", notificationsRoute);
app.route("/releases", releasesRoute);
app.route("/api/inbox", companionInboxRoute);

app.openapi(
  {
    method: "get",
    path: "/health",
    security: [],
    responses: {
      200: {
        description: "API health status",
        content: {
          "application/json": {
            schema: z.object({
              data: z.object({ status: z.literal("ok") }),
              error: z.null(),
            }),
          },
        },
      },
    },
  },
  (context) => context.json(ok({ status: "ok" as const })),
);

app.openapi(
  {
    method: "get",
    path: "/api/health",
    security: [],
    tags: ["Companion compatibility"],
    responses: {
      200: {
        description: "Companion-compatible API health status",
        content: {
          "application/json": {
            schema: z.object({
              status: z.literal("ok"),
              name: z.string(),
              version: z.string(),
              timestamp: z.iso.datetime(),
            }),
          },
        },
      },
    },
  },
  (context) =>
    context.json(
      {
        status: "ok" as const,
        name: "OpenMonetis",
        version: applicationVersion,
        timestamp: new Date().toISOString(),
      },
      200,
    ),
);

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "OpenMonetis API",
    version: applicationVersion,
    description: "API-first financial core for OpenMonetis V2 clients.",
  },
  servers: [
    {
      url: "/api-proxy",
      description: "Same-origin OpenMonetis API proxy",
    },
  ],
  security: [{ secureSessionCookie: [] }, { sessionCookie: [] }],
});

app.onError(errorHandler);
app.notFound(notFoundHandler);

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 7001);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`OpenMonetis API listening on http://localhost:${info.port}`);
  },
);

export { app };
