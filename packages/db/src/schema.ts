import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const accountType = pgEnum("account_type", [
  "checking",
  "savings",
  "investment",
  "cash",
  "benefits",
  "other",
]);

export const applicationTheme = pgEnum("application_theme", ["system", "light", "dark"]);

export const cardBrand = pgEnum("card_brand", [
  "visa",
  "mastercard",
  "elo",
  "amex",
  "hipercard",
  "other",
]);

export const cardStatus = pgEnum("card_status", ["active", "inactive"]);
export const cardClosingRuleType = pgEnum("card_closing_rule_type", ["fixedDay", "daysBeforeDue"]);
export const cardClosingOffsetMode = pgEnum("card_closing_offset_mode", [
  "calendarDays",
  "weekdays",
]);

export const categoryType = pgEnum("category_type", ["income", "expense"]);

export const invoicePaymentStatus = pgEnum("invoice_payment_status", ["pending", "paid"]);

export const inboxItemStatus = pgEnum("inbox_item_status", ["pending", "processed", "discarded"]);
export const inboxRuleMatchMode = pgEnum("inbox_rule_match_mode", ["all", "any"]);

export const noteKind = pgEnum("note_kind", ["text", "checklist"]);

export const paymentMethod = pgEnum("payment_method", [
  "credit_card",
  "debit_card",
  "pix",
  "cash",
  "boleto",
  "benefits",
  "bank_transfer",
]);

export const personRole = pgEnum("person_role", ["admin", "external"]);

export const personStatus = pgEnum("person_status", ["active", "inactive"]);

export const personConnectionInvitationStatus = pgEnum("person_connection_invitation_status", [
  "pending",
  "claimed",
  "confirmed",
  "cancelled",
  "expired",
]);

export const personConnectionStatus = pgEnum("person_connection_status", ["active", "revoked"]);

export const externalExpenseStatus = pgEnum("external_expense_status", ["pending", "imported"]);
export const externalExpenseSourceKind = pgEnum("external_expense_source_kind", [
  "transaction",
  "installmentSeries",
  "recurringOccurrence",
]);

export const recurrenceFrequency = pgEnum("recurrence_frequency", [
  "weekly",
  "monthly",
  "bimonthly",
  "quarterly",
  "semiannual",
  "annual",
]);

export const recurringRuleStatus = pgEnum("recurring_rule_status", [
  "active",
  "paused",
  "cancelled",
]);

export const transactionCondition = pgEnum("transaction_condition", [
  "single",
  "installment",
  "recurring",
]);

export const transactionType = pgEnum("transaction_type", ["income", "expense", "transfer"]);

export const transactionOrigin = pgEnum("transaction_origin", [
  "regular",
  "invoicePayment",
  "refund",
  "accountBalanceAdjustment",
  "invoiceAdjustment",
  "personSettlement",
]);

export const user = pgTable(
  "user",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_email_lower_unique").on(sql`lower(${table.email})`),
    check("user_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_issuer_account_unique").on(table.issuer, table.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    name: varchar("name", { length: 120 }),
    publicKey: text("public_key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_user_id_idx").on(table.userId),
    uniqueIndex("passkey_credential_id_unique").on(table.credentialID),
  ],
);

export const dashboardPreferences = pgTable("dashboard_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  widgetOrder: jsonb("widget_order").$type<string[]>().notNull(),
  hiddenWidgets: jsonb("hidden_widgets").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const notificationStates = pgTable(
  "notification_states",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notificationKey: varchar("notification_key", { length: 220 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 180 }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.notificationKey] }),
    index("notification_states_user_archived_idx").on(table.userId, table.archivedAt),
  ],
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 320 }),
    avatarUrl: text("avatar_url"),
    providerAvatarUrl: text("provider_avatar_url"),
    role: personRole("role").notNull().default("external"),
    status: personStatus("status").notNull().default("active"),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("people_user_id_status_idx").on(table.userId, table.status),
    uniqueIndex("people_id_user_id_unique").on(table.id, table.userId),
    uniqueIndex("people_user_id_admin_unique").on(table.userId).where(sql`${table.role} = 'admin'`),
    check("people_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
  ],
);

export const personConnectionInvitations = pgTable(
  "person_connection_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull(),
    claimedByUserId: uuid("claimed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull(),
    confirmationCodeDigest: varchar("confirmation_code_digest", { length: 64 }),
    confirmationAttempts: integer("confirmation_attempts").notNull().default(0),
    status: personConnectionInvitationStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmationExpiresAt: timestamp("confirmation_expires_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("person_connection_invitations_token_digest_unique").on(table.tokenDigest),
    uniqueIndex("person_connection_invitations_id_participants_unique").on(
      table.id,
      table.ownerUserId,
      table.personId,
      table.claimedByUserId,
    ),
    uniqueIndex("person_connection_invitations_active_person_unique")
      .on(table.ownerUserId, table.personId)
      .where(sql`${table.status} in ('pending', 'claimed')`),
    index("person_connection_invitations_owner_status_idx").on(table.ownerUserId, table.status),
    index("person_connection_invitations_claimed_status_idx").on(
      table.claimedByUserId,
      table.status,
    ),
    foreignKey({
      name: "person_connection_invitations_person_owner_fk",
      columns: [table.personId, table.ownerUserId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("cascade"),
    check(
      "person_connection_invitations_claim_check",
      sql`(
        ${table.status} = 'pending'
        AND ${table.claimedByUserId} IS NULL
        AND ${table.confirmationCodeDigest} IS NULL
        AND ${table.claimedAt} IS NULL
        AND ${table.confirmationExpiresAt} IS NULL
      ) OR ${table.status} <> 'pending'`,
    ),
    check(
      "person_connection_invitations_attempts_nonnegative_check",
      sql`${table.confirmationAttempts} >= 0`,
    ),
  ],
);

export const personConnections = pgTable(
  "person_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitationId: uuid("invitation_id")
      .notNull()
      .unique()
      .references(() => personConnectionInvitations.id, { onDelete: "restrict" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: personConnectionStatus("status").notNull().default("active"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("person_connections_id_participants_unique").on(
      table.id,
      table.ownerUserId,
      table.recipientUserId,
    ),
    uniqueIndex("person_connections_active_person_unique")
      .on(table.ownerUserId, table.personId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex("person_connections_active_pair_unique")
      .on(table.ownerUserId, table.recipientUserId)
      .where(sql`${table.status} = 'active'`),
    index("person_connections_owner_status_idx").on(table.ownerUserId, table.status),
    index("person_connections_recipient_status_idx").on(table.recipientUserId, table.status),
    foreignKey({
      name: "person_connections_person_owner_fk",
      columns: [table.personId, table.ownerUserId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "person_connections_invitation_participants_fk",
      columns: [table.invitationId, table.ownerUserId, table.personId, table.recipientUserId],
      foreignColumns: [
        personConnectionInvitations.id,
        personConnectionInvitations.ownerUserId,
        personConnectionInvitations.personId,
        personConnectionInvitations.claimedByUserId,
      ],
    }).onDelete("restrict"),
    check(
      "person_connections_distinct_users_check",
      sql`${table.ownerUserId} <> ${table.recipientUserId}`,
    ),
    check(
      "person_connections_revoked_at_check",
      sql`(${table.status} = 'active' AND ${table.revokedAt} IS NULL AND ${table.revokedByUserId} IS NULL) OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL)`,
    ),
  ],
);

export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    type: accountType("type").notNull(),
    logo: varchar("logo", { length: 255 }),
    note: text("note"),
    excludeFromBalance: boolean("exclude_from_balance").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("financial_accounts_user_id_archived_idx").on(table.userId, table.isArchived),
    uniqueIndex("financial_accounts_id_user_id_unique").on(table.id, table.userId),
    check("financial_accounts_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
  ],
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    brand: cardBrand("brand").notNull().default("other"),
    status: cardStatus("status").notNull().default("active"),
    closingDay: integer("closing_day"),
    closingRuleType: cardClosingRuleType("closing_rule_type").notNull().default("fixedDay"),
    closingOffsetDays: integer("closing_offset_days"),
    closingOffsetMode: cardClosingOffsetMode("closing_offset_mode"),
    dueDay: integer("due_day").notNull(),
    limit: numeric("limit", { precision: 12, scale: 2 }).notNull().default("0"),
    logo: varchar("logo", { length: 255 }),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cards_account_id_idx").on(table.accountId),
    index("cards_user_id_status_idx").on(table.userId, table.status),
    uniqueIndex("cards_id_user_id_unique").on(table.id, table.userId),
    foreignKey({
      name: "cards_account_id_user_id_financial_accounts_fk",
      columns: [table.accountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
    check("cards_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check("cards_limit_nonnegative_check", sql`${table.limit} >= 0`),
    check("cards_due_day_check", sql`${table.dueDay} BETWEEN 1 AND 31`),
    check(
      "cards_closing_rule_check",
      sql`(
        ${table.closingRuleType} = 'fixedDay'
        AND ${table.closingDay} BETWEEN 1 AND 31
        AND ${table.closingOffsetDays} IS NULL
        AND ${table.closingOffsetMode} IS NULL
      ) OR (
        ${table.closingRuleType} = 'daysBeforeDue'
        AND ${table.closingDay} IS NULL
        AND ${table.closingOffsetDays} BETWEEN 1 AND 31
        AND ${table.closingOffsetMode} IS NOT NULL
      )`,
    ),
  ],
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    theme: applicationTheme("theme").notNull().default("system"),
    hideValuesOnStart: boolean("hide_values_on_start").notNull().default(false),
    defaultPaymentMethod: paymentMethod("default_payment_method").notNull().default("credit_card"),
    defaultAccountId: uuid("default_account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    defaultCardId: uuid("default_card_id").references(() => cards.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    notificationDueSoonDays: integer("notification_due_soon_days").notNull().default(5),
    transactionsPageSize: integer("transactions_page_size").notNull().default(30),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("user_preferences_default_account_id_idx").on(table.defaultAccountId),
    index("user_preferences_default_card_id_idx").on(table.defaultCardId),
    check(
      "user_preferences_notification_due_soon_days_check",
      sql`${table.notificationDueSoonDays} in (1, 3, 5, 7)`,
    ),
    check(
      "user_preferences_transactions_page_size_check",
      sql`${table.transactionsPageSize} in (20, 30, 50)`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    type: categoryType("type").notNull(),
    icon: varchar("icon", { length: 100 }),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("categories_user_id_type_idx").on(table.userId, table.type),
    uniqueIndex("categories_user_id_name_type_unique").on(table.userId, table.name, table.type),
    uniqueIndex("categories_id_user_id_unique").on(table.id, table.userId),
    check("categories_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
  ],
);

export const establishmentLogos = pgTable(
  "establishment_logos",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    nameKey: varchar("name_key", { length: 180 }).notNull(),
    domain: varchar("domain", { length: 253 }).notNull(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId, table.nameKey] })],
);

export const recurringTransactionSeries = pgTable(
  "recurring_transaction_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recurring_transaction_series_user_id_idx").on(table.userId),
    uniqueIndex("recurring_transaction_series_id_user_id_unique").on(table.id, table.userId),
  ],
);

export const recurringTransactionRules = pgTable(
  "recurring_transaction_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => recurringTransactionSeries.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    type: transactionType("type").notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    startDate: date("start_date", { mode: "date" }).notNull(),
    endDate: date("end_date", { mode: "date" }),
    frequency: recurrenceFrequency("frequency").notNull(),
    accountId: uuid("account_id").references(() => financialAccounts.id, { onDelete: "restrict" }),
    cardId: uuid("card_id").references(() => cards.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "restrict" }),
    sourceAccountId: uuid("source_account_id").references(() => financialAccounts.id, {
      onDelete: "restrict",
    }),
    destinationAccountId: uuid("destination_account_id").references(() => financialAccounts.id, {
      onDelete: "restrict",
    }),
    dueDate: date("due_date", { mode: "date" }),
    isSettled: boolean("is_settled"),
    note: text("note"),
    status: recurringRuleStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recurring_transaction_rules_user_status_start_idx").on(
      table.userId,
      table.status,
      table.startDate,
    ),
    index("recurring_transaction_rules_person_id_idx").on(table.personId),
    index("recurring_transaction_rules_series_id_idx").on(table.seriesId),
    index("recurring_transaction_rules_account_id_idx").on(table.accountId),
    index("recurring_transaction_rules_card_id_idx").on(table.cardId),
    index("recurring_transaction_rules_category_id_idx").on(table.categoryId),
    index("recurring_transaction_rules_source_account_id_idx").on(table.sourceAccountId),
    index("recurring_transaction_rules_destination_account_id_idx").on(table.destinationAccountId),
    uniqueIndex("recurring_transaction_rules_id_user_id_unique").on(table.id, table.userId),
    foreignKey({
      name: "recurring_transaction_rules_series_user_fk",
      columns: [table.seriesId, table.userId],
      foreignColumns: [recurringTransactionSeries.id, recurringTransactionSeries.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "recurring_transaction_rules_person_user_fk",
      columns: [table.personId, table.userId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "recurring_transaction_rules_account_user_fk",
      columns: [table.accountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "recurring_transaction_rules_card_user_fk",
      columns: [table.cardId, table.userId],
      foreignColumns: [cards.id, cards.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "recurring_transaction_rules_category_user_fk",
      columns: [table.categoryId, table.userId],
      foreignColumns: [categories.id, categories.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "recurring_transaction_rules_source_account_user_fk",
      columns: [table.sourceAccountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "recurring_transaction_rules_destination_account_user_fk",
      columns: [table.destinationAccountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
    check("recurring_transaction_rules_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check("recurring_transaction_rules_amount_nonzero_check", sql`${table.amount} <> 0`),
  ],
);

export const installmentSeries = pgTable(
  "installment_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    totalInstallments: integer("total_installments").notNull(),
    trackedFromInstallment: integer("tracked_from_installment").notNull(),
    originalAmount: numeric("original_amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("installment_series_user_id_idx").on(table.userId),
    uniqueIndex("installment_series_id_user_id_unique").on(table.id, table.userId),
    check(
      "installment_series_total_installments_check",
      sql`${table.totalInstallments} BETWEEN 2 AND 60`,
    ),
    check(
      "installment_series_tracked_from_installment_check",
      sql`${table.trackedFromInstallment} BETWEEN 1 AND ${table.totalInstallments}`,
    ),
    check("installment_series_original_amount_positive_check", sql`${table.originalAmount} > 0`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    type: transactionType("type").notNull(),
    origin: transactionOrigin("origin").notNull().default("regular"),
    condition: transactionCondition("condition").notNull().default("single"),
    paymentMethod: paymentMethod("payment_method"),
    name: varchar("name", { length: 160 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    purchaseDate: date("purchase_date", { mode: "date" }).notNull(),
    period: varchar("period", { length: 7 }).notNull(),
    accountId: uuid("account_id").references(() => financialAccounts.id, { onDelete: "restrict" }),
    cardId: uuid("card_id").references(() => cards.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "restrict" }),
    sourceAccountId: uuid("source_account_id").references(() => financialAccounts.id, {
      onDelete: "restrict",
    }),
    destinationAccountId: uuid("destination_account_id").references(() => financialAccounts.id, {
      onDelete: "restrict",
    }),
    dueDate: date("due_date", { mode: "date" }),
    boletoPaymentDate: date("boleto_payment_date", { mode: "date" }),
    installmentCount: integer("installment_count"),
    currentInstallment: integer("current_installment"),
    seriesId: uuid("series_id"),
    transferId: uuid("transfer_id"),
    recurringRuleId: uuid("recurring_rule_id").references(() => recurringTransactionRules.id, {
      onDelete: "set null",
    }),
    isSettled: boolean("is_settled"),
    note: text("note"),
    importSourceFingerprint: varchar("import_source_fingerprint", { length: 64 }),
    importExternalId: varchar("import_external_id", { length: 255 }),
    importBatchId: uuid("import_batch_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("transactions_user_period_order_idx").on(
      table.userId,
      table.period,
      table.purchaseDate.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("transactions_user_purchase_order_idx").on(
      table.userId,
      table.purchaseDate.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("transactions_user_id_type_period_idx").on(table.userId, table.type, table.period),
    index("transactions_person_id_idx").on(table.personId),
    index("transactions_account_id_idx")
      .on(table.accountId)
      .where(sql`${table.accountId} IS NOT NULL`),
    index("transactions_card_id_idx").on(table.cardId).where(sql`${table.cardId} IS NOT NULL`),
    index("transactions_category_id_idx")
      .on(table.categoryId)
      .where(sql`${table.categoryId} IS NOT NULL`),
    index("transactions_source_account_id_idx")
      .on(table.sourceAccountId)
      .where(sql`${table.sourceAccountId} IS NOT NULL`),
    index("transactions_destination_account_id_idx")
      .on(table.destinationAccountId)
      .where(sql`${table.destinationAccountId} IS NOT NULL`),
    index("transactions_transfer_id_user_id_idx")
      .on(table.transferId, table.userId)
      .where(sql`${table.transferId} IS NOT NULL`),
    index("transactions_import_batch_user_id_idx")
      .on(table.importBatchId, table.userId)
      .where(sql`${table.importBatchId} IS NOT NULL`),
    uniqueIndex("transactions_import_source_external_user_unique")
      .on(table.userId, table.importSourceFingerprint, table.importExternalId)
      .where(sql`${table.importExternalId} IS NOT NULL`),
    uniqueIndex("transactions_user_id_series_current_installment_unique")
      .on(table.userId, table.seriesId, table.currentInstallment)
      .where(sql`${table.seriesId} IS NOT NULL`),
    uniqueIndex("transactions_id_user_id_unique").on(table.id, table.userId),
    foreignKey({
      name: "transactions_person_id_user_id_people_fk",
      columns: [table.personId, table.userId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "transactions_account_id_user_id_financial_accounts_fk",
      columns: [table.accountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "transactions_card_id_user_id_cards_fk",
      columns: [table.cardId, table.userId],
      foreignColumns: [cards.id, cards.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "transactions_category_id_user_id_categories_fk",
      columns: [table.categoryId, table.userId],
      foreignColumns: [categories.id, categories.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "transactions_source_account_id_user_id_accounts_fk",
      columns: [table.sourceAccountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "transactions_destination_account_id_user_id_accounts_fk",
      columns: [table.destinationAccountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "transactions_series_id_user_id_installment_series_fk",
      columns: [table.seriesId, table.userId],
      foreignColumns: [installmentSeries.id, installmentSeries.userId],
    }).onDelete("cascade"),
    index("transactions_recurring_rule_id_idx")
      .on(table.recurringRuleId)
      .where(sql`${table.recurringRuleId} IS NOT NULL`),
    check("transactions_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check("transactions_amount_nonzero_check", sql`${table.amount} <> 0`),
    check(
      "transactions_period_format_check",
      sql`${table.period} ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'`,
    ),
    check(
      "transactions_installment_metadata_check",
      sql`(
        ${table.condition} = 'installment'
        AND ${table.installmentCount} IS NOT NULL
        AND ${table.installmentCount} BETWEEN 2 AND 60
        AND ${table.currentInstallment} IS NOT NULL
        AND ${table.currentInstallment} BETWEEN 1 AND ${table.installmentCount}
        AND ${table.seriesId} IS NOT NULL
      ) OR (
        ${table.condition} <> 'installment'
        AND ${table.installmentCount} IS NULL
        AND ${table.currentInstallment} IS NULL
        AND ${table.seriesId} IS NULL
      )`,
    ),
    check(
      "transactions_payment_method_origin_check",
      sql`(
        ${table.origin} = 'accountBalanceAdjustment'
        AND ${table.paymentMethod} IS NULL
      ) OR (
        ${table.origin} <> 'accountBalanceAdjustment'
        AND ${table.paymentMethod} IS NOT NULL
      )`,
    ),
  ],
);

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull(),
    tokenPrefix: varchar("token_prefix", { length: 12 }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("device_tokens_token_digest_unique").on(table.tokenDigest),
    index("device_tokens_user_id_created_at_idx").on(table.userId, table.createdAt),
    check("device_tokens_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check("device_tokens_expiration_check", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deviceTokenId: uuid("device_token_id").references(() => deviceTokens.id, {
      onDelete: "set null",
    }),
    sourceApp: varchar("source_app", { length: 255 }).notNull(),
    sourceAppName: varchar("source_app_name", { length: 255 }),
    originalTitle: varchar("original_title", { length: 500 }),
    originalText: text("original_text").notNull(),
    notificationTimestamp: timestamp("notification_timestamp", { withTimezone: true }).notNull(),
    parsedName: varchar("parsed_name", { length: 160 }),
    parsedAmount: numeric("parsed_amount", { precision: 12, scale: 2 }),
    clientId: varchar("client_id", { length: 255 }).notNull(),
    payloadFingerprint: varchar("payload_fingerprint", { length: 64 }).notNull(),
    status: inboxItemStatus("status").notNull().default("pending"),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    discardedAt: timestamp("discarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("inbox_items_user_id_client_id_unique").on(table.userId, table.clientId),
    index("inbox_items_user_id_status_notification_idx").on(
      table.userId,
      table.status,
      table.notificationTimestamp.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("inbox_items_user_id_status_source_notification_idx").on(
      table.userId,
      table.status,
      table.sourceAppName,
      table.notificationTimestamp.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("inbox_items_device_token_id_idx").on(table.deviceTokenId),
    index("inbox_items_transaction_id_idx").on(table.transactionId),
    check("inbox_items_source_app_not_blank_check", sql`btrim(${table.sourceApp}) <> ''`),
    check("inbox_items_original_text_not_blank_check", sql`btrim(${table.originalText}) <> ''`),
    check("inbox_items_client_id_not_blank_check", sql`btrim(${table.clientId}) <> ''`),
    check(
      "inbox_items_parsed_amount_positive_check",
      sql`${table.parsedAmount} IS NULL OR ${table.parsedAmount} > 0`,
    ),
    check(
      "inbox_items_status_metadata_check",
      sql`(
        ${table.status} = 'pending'
        AND ${table.transactionId} IS NULL
        AND ${table.processedAt} IS NULL
        AND ${table.discardedAt} IS NULL
      ) OR (
        ${table.status} = 'processed'
        AND ${table.processedAt} IS NOT NULL
        AND ${table.discardedAt} IS NULL
      ) OR (
        ${table.status} = 'discarded'
        AND ${table.transactionId} IS NULL
        AND ${table.processedAt} IS NULL
        AND ${table.discardedAt} IS NOT NULL
      )`,
    ),
  ],
);

export const inboxRules = pgTable(
  "inbox_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    priority: integer("priority").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    matchMode: inboxRuleMatchMode("match_mode").notNull().default("all"),
    conditions: jsonb("conditions").notNull(),
    categoryId: uuid("category_id"),
    personId: uuid("person_id"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("inbox_rules_user_id_name_unique").on(table.userId, table.name),
    uniqueIndex("inbox_rules_id_user_id_unique").on(table.id, table.userId),
    index("inbox_rules_user_id_active_priority_idx").on(
      table.userId,
      table.isActive,
      table.priority,
    ),
    foreignKey({
      name: "inbox_rules_category_user_fk",
      columns: [table.categoryId, table.userId],
      foreignColumns: [categories.id, categories.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "inbox_rules_person_user_fk",
      columns: [table.personId, table.userId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("cascade"),
    check("inbox_rules_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check("inbox_rules_priority_range_check", sql`${table.priority} between 0 and 9999`),
    check("inbox_rules_version_positive_check", sql`${table.version} > 0`),
    check(
      "inbox_rules_actions_required_check",
      sql`${table.categoryId} is not null or ${table.personId} is not null`,
    ),
    check(
      "inbox_rules_conditions_array_check",
      sql`jsonb_typeof(${table.conditions}) = 'array' and jsonb_array_length(${table.conditions}) between 1 and 5`,
    ),
  ],
);

export const importCategoryMappings = pgTable(
  "import_category_mappings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    descriptionKey: varchar("description_key", { length: 160 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.descriptionKey] }),
    index("import_category_mappings_category_id_idx").on(table.categoryId),
    foreignKey({
      name: "import_category_mappings_category_user_fk",
      columns: [table.categoryId, table.userId],
      foreignColumns: [categories.id, categories.userId],
    }).onDelete("cascade"),
  ],
);

export const transactionSplits = pgTable(
  "transaction_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("transaction_splits_user_id_idx").on(table.userId),
    index("transaction_splits_person_id_user_id_idx").on(table.personId, table.userId),
    uniqueIndex("transaction_splits_transaction_person_unique").on(
      table.transactionId,
      table.personId,
    ),
    foreignKey({
      name: "transaction_splits_transaction_user_fk",
      columns: [table.transactionId, table.userId],
      foreignColumns: [transactions.id, transactions.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "transaction_splits_person_user_fk",
      columns: [table.personId, table.userId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("restrict"),
    check("transaction_splits_amount_nonzero_check", sql`${table.amount} <> 0`),
  ],
);

export const externalExpenses = pgTable(
  "external_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id").notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceKind: externalExpenseSourceKind("source_kind").notNull().default("transaction"),
    sourceTransactionId: uuid("source_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    sourceSeriesId: uuid("source_series_id").references(() => installmentSeries.id, {
      onDelete: "set null",
    }),
    sourceRecurringSeriesId: uuid("source_recurring_series_id").references(
      () => recurringTransactionSeries.id,
      { onDelete: "set null" },
    ),
    sourceRecurringRuleId: uuid("source_recurring_rule_id").references(
      () => recurringTransactionRules.id,
      { onDelete: "set null" },
    ),
    sourceOccurrenceDate: date("source_occurrence_date", { mode: "date" }),
    sourcePersonId: uuid("source_person_id").notNull(),
    importedTransactionId: uuid("imported_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    status: externalExpenseStatus("status").notNull().default("pending"),
    sourceVersion: integer("source_version").notNull().default(1),
    name: varchar("name", { length: 160 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    purchaseDate: date("purchase_date", { mode: "date" }).notNull(),
    period: varchar("period", { length: 7 }).notNull(),
    dueDate: date("due_date", { mode: "date" }),
    sourcePaymentMethod: paymentMethod("source_payment_method").notNull(),
    sourceCondition: transactionCondition("source_condition").notNull(),
    installmentCount: integer("installment_count"),
    currentInstallment: integer("current_installment"),
    sourceLabel: varchar("source_label", { length: 120 }),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("external_expenses_recipient_status_updated_idx").on(
      table.recipientUserId,
      table.status,
      table.updatedAt.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("external_expenses_recipient_updated_idx").on(
      table.recipientUserId,
      table.updatedAt.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("external_expenses_source_transaction_idx").on(table.sourceTransactionId),
    index("external_expenses_source_series_idx").on(table.sourceSeriesId),
    index("external_expenses_source_recurring_series_idx").on(table.sourceRecurringSeriesId),
    index("external_expenses_imported_transaction_idx").on(table.importedTransactionId),
    index("external_expenses_connection_idx").on(table.connectionId),
    uniqueIndex("external_expenses_source_transaction_allocation_unique")
      .on(table.ownerUserId, table.sourceTransactionId, table.sourcePersonId)
      .where(sql`${table.sourceTransactionId} IS NOT NULL AND ${table.sourceSeriesId} IS NULL`),
    uniqueIndex("external_expenses_source_series_allocation_unique")
      .on(table.ownerUserId, table.sourceSeriesId, table.sourcePersonId)
      .where(sql`${table.sourceSeriesId} IS NOT NULL`),
    uniqueIndex("external_expenses_source_recurring_occurrence_allocation_unique")
      .on(
        table.ownerUserId,
        table.sourceRecurringSeriesId,
        table.sourceOccurrenceDate,
        table.sourcePersonId,
      )
      .where(sql`${table.sourceRecurringSeriesId} IS NOT NULL`),
    foreignKey({
      name: "external_expenses_connection_participants_fk",
      columns: [table.connectionId, table.ownerUserId, table.recipientUserId],
      foreignColumns: [
        personConnections.id,
        personConnections.ownerUserId,
        personConnections.recipientUserId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "external_expenses_source_person_owner_fk",
      columns: [table.sourcePersonId, table.ownerUserId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("restrict"),
    check("external_expenses_source_version_positive_check", sql`${table.sourceVersion} > 0`),
    check("external_expenses_amount_positive_check", sql`${table.amount} > 0`),
    check("external_expenses_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check(
      "external_expenses_period_format_check",
      sql`${table.period} ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'`,
    ),
    check(
      "external_expenses_condition_check",
      sql`(
        ${table.sourceCondition} in ('single', 'recurring')
        AND ${table.installmentCount} IS NULL
        AND ${table.currentInstallment} IS NULL
      ) OR (
        ${table.sourceCondition} = 'installment'
        AND ${table.installmentCount} BETWEEN 2 AND 60
        AND ${table.currentInstallment} BETWEEN 1 AND ${table.installmentCount}
      )`,
    ),
    check(
      "external_expenses_source_kind_check",
      sql`(
        ${table.sourceKind} = 'transaction'
        AND (${table.sourceTransactionId} IS NOT NULL OR ${table.status} = 'imported')
        AND ${table.sourceSeriesId} IS NULL
        AND ${table.sourceRecurringSeriesId} IS NULL
        AND ${table.sourceRecurringRuleId} IS NULL
        AND ${table.sourceOccurrenceDate} IS NULL
      ) OR (
        ${table.sourceKind} = 'installmentSeries'
        AND (${table.sourceSeriesId} IS NOT NULL OR ${table.status} = 'imported')
        AND ${table.sourceRecurringSeriesId} IS NULL
        AND ${table.sourceRecurringRuleId} IS NULL
        AND ${table.sourceOccurrenceDate} IS NULL
      ) OR (
        ${table.sourceKind} = 'recurringOccurrence'
        AND ${table.sourceTransactionId} IS NULL
        AND ${table.sourceSeriesId} IS NULL
        AND (
          (${table.sourceRecurringSeriesId} IS NOT NULL AND ${table.sourceRecurringRuleId} IS NOT NULL)
          OR ${table.status} = 'imported'
        )
        AND ${table.sourceOccurrenceDate} IS NOT NULL
        AND ${table.sourceCondition} = 'recurring'
      )`,
    ),
  ],
);

export const backgroundJobCheckpoints = pgTable("background_job_checkpoints", {
  jobName: varchar("job_name", { length: 120 }).primaryKey(),
  lastCompletedDate: date("last_completed_date", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const installmentAnticipations = pgTable(
  "installment_anticipations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id").notNull(),
    targetPeriod: varchar("target_period", { length: 7 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    adjustmentTransactionId: uuid("adjustment_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("installment_anticipations_user_series_idx").on(table.userId, table.seriesId),
    index("installment_anticipations_adjustment_transaction_idx").on(table.adjustmentTransactionId),
    uniqueIndex("installment_anticipations_id_user_id_unique").on(table.id, table.userId),
    foreignKey({
      name: "installment_anticipations_series_user_id_fk",
      columns: [table.seriesId, table.userId],
      foreignColumns: [installmentSeries.id, installmentSeries.userId],
    }).onDelete("cascade"),
    check("installment_anticipations_discount_nonnegative", sql`${table.discount} >= 0`),
    check(
      "installment_anticipations_target_period_format_check",
      sql`${table.targetPeriod} ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'`,
    ),
  ],
);

export const installmentAnticipationItems = pgTable(
  "installment_anticipation_items",
  {
    anticipationId: uuid("anticipation_id")
      .notNull()
      .references(() => installmentAnticipations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    originalPeriod: varchar("original_period", { length: 7 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.anticipationId, table.transactionId] }),
    uniqueIndex("installment_anticipation_items_transaction_unique").on(table.transactionId),
    index("installment_anticipation_items_user_id_idx").on(table.userId),
    check(
      "installment_anticipation_items_original_period_format_check",
      sql`${table.originalPeriod} ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'`,
    ),
  ],
);

export const transactionRefunds = pgTable(
  "transaction_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceTransactionId: uuid("source_transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    refundTransactionId: uuid("refund_transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("transaction_refunds_source_user_idx").on(table.sourceTransactionId, table.userId),
    uniqueIndex("transaction_refunds_refund_transaction_unique").on(table.refundTransactionId),
    foreignKey({
      name: "transaction_refunds_source_transaction_user_fk",
      columns: [table.sourceTransactionId, table.userId],
      foreignColumns: [transactions.id, transactions.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "transaction_refunds_refund_transaction_user_fk",
      columns: [table.refundTransactionId, table.userId],
      foreignColumns: [transactions.id, transactions.userId],
    }).onDelete("cascade"),
    check("transaction_refunds_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const recurringTransactionSplits = pgTable(
  "recurring_transaction_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recurringRuleId: uuid("recurring_rule_id")
      .notNull()
      .references(() => recurringTransactionRules.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("recurring_transaction_splits_user_id_idx").on(table.userId),
    index("recurring_transaction_splits_person_user_idx").on(table.personId, table.userId),
    uniqueIndex("recurring_transaction_splits_rule_person_unique").on(
      table.recurringRuleId,
      table.personId,
    ),
    foreignKey({
      name: "recurring_transaction_splits_rule_user_fk",
      columns: [table.recurringRuleId, table.userId],
      foreignColumns: [recurringTransactionRules.id, recurringTransactionRules.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "recurring_transaction_splits_person_user_fk",
      columns: [table.personId, table.userId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("restrict"),
    check("recurring_transaction_splits_amount_nonzero_check", sql`${table.amount} <> 0`),
  ],
);

export const recurringTransactionOccurrences = pgTable(
  "recurring_transaction_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recurringRuleId: uuid("recurring_rule_id")
      .notNull()
      .references(() => recurringTransactionRules.id, { onDelete: "cascade" }),
    purchaseDate: date("purchase_date", { mode: "date" }).notNull(),
    isSettled: boolean("is_settled").notNull(),
    accountId: uuid("account_id").references(() => financialAccounts.id, {
      onDelete: "restrict",
    }),
    boletoPaymentDate: date("boleto_payment_date", { mode: "date" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recurring_transaction_occurrences_user_purchase_rule_idx").on(
      table.userId,
      table.purchaseDate,
      table.recurringRuleId,
    ),
    index("recurring_transaction_occurrences_account_id_idx").on(table.accountId),
    uniqueIndex("recurring_transaction_occurrences_rule_date_unique").on(
      table.recurringRuleId,
      table.purchaseDate,
    ),
    foreignKey({
      name: "recurring_transaction_occurrences_rule_user_fk",
      columns: [table.recurringRuleId, table.userId],
      foreignColumns: [recurringTransactionRules.id, recurringTransactionRules.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "recurring_transaction_occurrences_account_user_fk",
      columns: [table.accountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull().unique(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("attachments_user_id_idx").on(table.userId),
    uniqueIndex("attachments_id_user_id_unique").on(table.id, table.userId),
  ],
);

export const transactionAttachments = pgTable(
  "transaction_attachments",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    attachmentId: uuid("attachment_id")
      .notNull()
      .references(() => attachments.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.attachmentId] }),
    index("transaction_attachments_user_id_idx").on(table.userId),
    index("transaction_attachments_attachment_id_idx").on(table.attachmentId),
    foreignKey({
      name: "transaction_attachments_transaction_user_fk",
      columns: [table.transactionId, table.userId],
      foreignColumns: [transactions.id, transactions.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "transaction_attachments_attachment_user_fk",
      columns: [table.attachmentId, table.userId],
      foreignColumns: [attachments.id, attachments.userId],
    }).onDelete("cascade"),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade", onUpdate: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(),
    paymentStatus: invoicePaymentStatus("payment_status").notNull().default("pending"),
    paidAt: timestamp("paid_at"),
    paymentAccountId: uuid("payment_account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    closingDate: date("closing_date", { mode: "date" }),
    dueDate: date("due_date", { mode: "date" }),
    datesCustomized: boolean("dates_customized").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("invoices_user_id_period_idx").on(table.userId, table.period),
    index("invoices_card_id_period_idx").on(table.cardId, table.period),
    index("invoices_payment_account_idx").on(table.paymentAccountId),
    uniqueIndex("invoices_user_id_card_id_period_unique").on(
      table.userId,
      table.cardId,
      table.period,
    ),
    foreignKey({
      name: "invoices_card_id_user_id_cards_fk",
      columns: [table.cardId, table.userId],
      foreignColumns: [cards.id, cards.userId],
    }).onDelete("cascade"),
    check("invoices_period_format_check", sql`${table.period} ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'`),
    check(
      "invoices_payment_status_metadata_check",
      sql`(
        ${table.paymentStatus} = 'pending'
        AND ${table.paidAt} IS NULL
        AND ${table.paymentAccountId} IS NULL
      ) OR (
        ${table.paymentStatus} = 'paid'
        AND ${table.paidAt} IS NOT NULL
      )`,
    ),
  ],
);

export const invoicePayments = pgTable(
  "invoice_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(),
    accountId: uuid("account_id").references(() => financialAccounts.id, {
      onDelete: "restrict",
    }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "restrict",
    }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paidAt: date("paid_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoice_payments_user_period_created_idx").on(
      table.userId,
      table.period,
      table.createdAt.desc(),
    ),
    index("invoice_payments_user_card_period_idx").on(table.userId, table.cardId, table.period),
    index("invoice_payments_card_user_idx").on(table.cardId, table.userId),
    index("invoice_payments_account_user_idx").on(table.accountId, table.userId),
    index("invoice_payments_transaction_user_idx").on(table.transactionId, table.userId),
    uniqueIndex("invoice_payments_id_user_id_unique").on(table.id, table.userId),
    foreignKey({
      name: "invoice_payments_card_user_fk",
      columns: [table.cardId, table.userId],
      foreignColumns: [cards.id, cards.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "invoice_payments_account_user_fk",
      columns: [table.accountId, table.userId],
      foreignColumns: [financialAccounts.id, financialAccounts.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoice_payments_transaction_user_fk",
      columns: [table.transactionId, table.userId],
      foreignColumns: [transactions.id, transactions.userId],
    }).onDelete("restrict"),
    check(
      "invoice_payments_period_format_check",
      sql`${table.period} ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'`,
    ),
    check("invoice_payments_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const invoicePaymentAllocations = pgTable(
  "invoice_payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => invoicePayments.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoice_payment_allocations_payment_idx").on(table.paymentId),
    index("invoice_payment_allocations_person_user_idx").on(table.personId, table.userId),
    uniqueIndex("invoice_payment_allocations_id_user_unique").on(table.id, table.userId),
    foreignKey({
      name: "invoice_payment_allocations_payment_user_fk",
      columns: [table.paymentId, table.userId],
      foreignColumns: [invoicePayments.id, invoicePayments.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "invoice_payment_allocations_person_user_fk",
      columns: [table.personId, table.userId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("restrict"),
    check("invoice_payment_allocations_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const personSettlements = pgTable(
  "person_settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    invoicePaymentAllocationId: uuid("invoice_payment_allocation_id").references(
      () => invoicePaymentAllocations.id,
      { onDelete: "cascade" },
    ),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    receivedAt: date("received_at", { mode: "date" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("person_settlements_user_person_received_idx").on(
      table.userId,
      table.personId,
      table.receivedAt.desc(),
      table.createdAt.desc(),
    ),
    uniqueIndex("person_settlements_invoice_allocation_unique").on(
      table.invoicePaymentAllocationId,
    ),
    foreignKey({
      name: "person_settlements_person_user_fk",
      columns: [table.personId, table.userId],
      foreignColumns: [people.id, people.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "person_settlements_invoice_allocation_user_fk",
      columns: [table.invoicePaymentAllocationId, table.userId],
      foreignColumns: [invoicePaymentAllocations.id, invoicePaymentAllocations.userId],
    }).onDelete("cascade"),
    check("person_settlements_amount_positive_check", sql`${table.amount} > 0`),
    check(
      "person_settlements_note_not_blank_check",
      sql`${table.note} IS NULL OR btrim(${table.note}) <> ''`,
    ),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade", onUpdate: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("budgets_user_id_period_idx").on(table.userId, table.period),
    index("budgets_category_id_idx").on(table.categoryId),
    uniqueIndex("budgets_user_id_category_id_period_unique").on(
      table.userId,
      table.categoryId,
      table.period,
    ),
    foreignKey({
      name: "budgets_category_id_user_id_categories_fk",
      columns: [table.categoryId, table.userId],
      foreignColumns: [categories.id, categories.userId],
    }).onDelete("cascade"),
    check("budgets_amount_positive_check", sql`${table.amount} > 0`),
    check("budgets_period_format_check", sql`${table.period} ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'`),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull(),
    kind: noteKind("kind").notNull(),
    content: text("content"),
    isArchived: boolean("is_archived").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("notes_user_id_archived_updated_at_idx").on(
      table.userId,
      table.isArchived,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    uniqueIndex("notes_id_user_id_unique").on(table.id, table.userId),
    check("notes_title_not_blank_check", sql`btrim(${table.title}) <> ''`),
    check(
      "notes_content_matches_kind_check",
      sql`(${table.kind} = 'text' AND ${table.content} IS NOT NULL AND btrim(${table.content}) <> '') OR (${table.kind} = 'checklist' AND ${table.content} IS NULL)`,
    ),
    check("notes_version_positive_check", sql`${table.version} > 0`),
  ],
);

export const noteItems = pgTable(
  "note_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    noteId: uuid("note_id").notNull(),
    text: varchar("text", { length: 300 }).notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("note_items_user_id_note_id_position_idx").on(table.userId, table.noteId, table.position),
    uniqueIndex("note_items_note_id_position_unique").on(table.noteId, table.position),
    foreignKey({
      name: "note_items_note_id_user_id_notes_fk",
      columns: [table.noteId, table.userId],
      foreignColumns: [notes.id, notes.userId],
    }).onDelete("cascade"),
    check("note_items_text_not_blank_check", sql`btrim(${table.text}) <> ''`),
    check("note_items_position_nonnegative_check", sql`${table.position} >= 0`),
  ],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  authAccounts: many(account),
  passkeys: many(passkey),
  people: many(people),
  financialAccounts: many(financialAccounts),
  cards: many(cards),
  categories: many(categories),
  recurringTransactionRules: many(recurringTransactionRules),
  recurringTransactionSeries: many(recurringTransactionSeries),
  installmentSeries: many(installmentSeries),
  transactions: many(transactions),
  invoices: many(invoices),
  budgets: many(budgets),
  attachments: many(attachments),
  transactionSplits: many(transactionSplits),
  recurringTransactionSplits: many(recurringTransactionSplits),
  personSettlements: many(personSettlements),
  notes: many(notes),
  noteItems: many(noteItems),
  deviceTokens: many(deviceTokens),
  inboxItems: many(inboxItems),
  inboxRules: many(inboxRules),
  dashboardPreferences: one(dashboardPreferences),
  preferences: one(userPreferences),
}));

export const dashboardPreferencesRelations = relations(dashboardPreferences, ({ one }) => ({
  user: one(user, {
    fields: [dashboardPreferences.userId],
    references: [user.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(user, {
    fields: [userPreferences.userId],
    references: [user.id],
  }),
  defaultAccount: one(financialAccounts, {
    fields: [userPreferences.defaultAccountId],
    references: [financialAccounts.id],
  }),
  defaultCard: one(cards, {
    fields: [userPreferences.defaultCardId],
    references: [cards.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  user: one(user, {
    fields: [people.userId],
    references: [user.id],
  }),
  transactions: many(transactions),
  recurringTransactionRules: many(recurringTransactionRules),
  transactionSplits: many(transactionSplits),
  recurringTransactionSplits: many(recurringTransactionSplits),
  personSettlements: many(personSettlements),
  inboxRules: many(inboxRules),
}));

export const financialAccountsRelations = relations(financialAccounts, ({ one, many }) => ({
  user: one(user, {
    fields: [financialAccounts.userId],
    references: [user.id],
  }),
  cards: many(cards),
  transactions: many(transactions, { relationName: "transactionAccount" }),
  sourceTransfers: many(transactions, { relationName: "sourceAccount" }),
  destinationTransfers: many(transactions, { relationName: "destinationAccount" }),
  recurringRules: many(recurringTransactionRules, { relationName: "recurringRuleAccount" }),
  recurringRuleSourceTransfers: many(recurringTransactionRules, {
    relationName: "recurringRuleSourceAccount",
  }),
  recurringRuleDestinationTransfers: many(recurringTransactionRules, {
    relationName: "recurringRuleDestinationAccount",
  }),
  paidInvoices: many(invoices),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  user: one(user, {
    fields: [cards.userId],
    references: [user.id],
  }),
  account: one(financialAccounts, {
    fields: [cards.accountId],
    references: [financialAccounts.id],
  }),
  transactions: many(transactions),
  recurringTransactionRules: many(recurringTransactionRules),
  invoices: many(invoices),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(user, {
    fields: [categories.userId],
    references: [user.id],
  }),
  transactions: many(transactions),
  recurringTransactionRules: many(recurringTransactionRules),
  budgets: many(budgets),
  inboxRules: many(inboxRules),
}));

export const recurringTransactionRulesRelations = relations(
  recurringTransactionRules,
  ({ one, many }) => ({
    user: one(user, {
      fields: [recurringTransactionRules.userId],
      references: [user.id],
    }),
    series: one(recurringTransactionSeries, {
      fields: [recurringTransactionRules.seriesId],
      references: [recurringTransactionSeries.id],
    }),
    person: one(people, {
      fields: [recurringTransactionRules.personId],
      references: [people.id],
    }),
    account: one(financialAccounts, {
      fields: [recurringTransactionRules.accountId],
      references: [financialAccounts.id],
      relationName: "recurringRuleAccount",
    }),
    card: one(cards, {
      fields: [recurringTransactionRules.cardId],
      references: [cards.id],
    }),
    category: one(categories, {
      fields: [recurringTransactionRules.categoryId],
      references: [categories.id],
    }),
    sourceAccount: one(financialAccounts, {
      fields: [recurringTransactionRules.sourceAccountId],
      references: [financialAccounts.id],
      relationName: "recurringRuleSourceAccount",
    }),
    destinationAccount: one(financialAccounts, {
      fields: [recurringTransactionRules.destinationAccountId],
      references: [financialAccounts.id],
      relationName: "recurringRuleDestinationAccount",
    }),
    transactions: many(transactions),
    splits: many(recurringTransactionSplits),
  }),
);

export const recurringTransactionSeriesRelations = relations(
  recurringTransactionSeries,
  ({ one, many }) => ({
    user: one(user, {
      fields: [recurringTransactionSeries.userId],
      references: [user.id],
    }),
    rules: many(recurringTransactionRules),
  }),
);

export const installmentSeriesRelations = relations(installmentSeries, ({ one, many }) => ({
  user: one(user, {
    fields: [installmentSeries.userId],
    references: [user.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(user, {
    fields: [transactions.userId],
    references: [user.id],
  }),
  person: one(people, {
    fields: [transactions.personId],
    references: [people.id],
  }),
  account: one(financialAccounts, {
    fields: [transactions.accountId],
    references: [financialAccounts.id],
    relationName: "transactionAccount",
  }),
  card: one(cards, {
    fields: [transactions.cardId],
    references: [cards.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  sourceAccount: one(financialAccounts, {
    fields: [transactions.sourceAccountId],
    references: [financialAccounts.id],
    relationName: "sourceAccount",
  }),
  destinationAccount: one(financialAccounts, {
    fields: [transactions.destinationAccountId],
    references: [financialAccounts.id],
    relationName: "destinationAccount",
  }),
  recurringRule: one(recurringTransactionRules, {
    fields: [transactions.recurringRuleId],
    references: [recurringTransactionRules.id],
  }),
  series: one(installmentSeries, {
    fields: [transactions.seriesId],
    references: [installmentSeries.id],
  }),
  splits: many(transactionSplits),
  attachments: many(transactionAttachments),
  inboxItems: many(inboxItems),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one, many }) => ({
  user: one(user, { fields: [deviceTokens.userId], references: [user.id] }),
  inboxItems: many(inboxItems),
}));

export const inboxItemsRelations = relations(inboxItems, ({ one }) => ({
  user: one(user, { fields: [inboxItems.userId], references: [user.id] }),
  deviceToken: one(deviceTokens, {
    fields: [inboxItems.deviceTokenId],
    references: [deviceTokens.id],
  }),
  transaction: one(transactions, {
    fields: [inboxItems.transactionId],
    references: [transactions.id],
  }),
}));

export const inboxRulesRelations = relations(inboxRules, ({ one }) => ({
  user: one(user, { fields: [inboxRules.userId], references: [user.id] }),
  category: one(categories, { fields: [inboxRules.categoryId], references: [categories.id] }),
  person: one(people, { fields: [inboxRules.personId], references: [people.id] }),
}));

export const transactionSplitsRelations = relations(transactionSplits, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionSplits.transactionId],
    references: [transactions.id],
  }),
  person: one(people, {
    fields: [transactionSplits.personId],
    references: [people.id],
  }),
}));

export const recurringTransactionSplitsRelations = relations(
  recurringTransactionSplits,
  ({ one }) => ({
    rule: one(recurringTransactionRules, {
      fields: [recurringTransactionSplits.recurringRuleId],
      references: [recurringTransactionRules.id],
    }),
    person: one(people, {
      fields: [recurringTransactionSplits.personId],
      references: [people.id],
    }),
  }),
);

export const attachmentsRelations = relations(attachments, ({ one, many }) => ({
  user: one(user, { fields: [attachments.userId], references: [user.id] }),
  transactions: many(transactionAttachments),
}));

export const transactionAttachmentsRelations = relations(transactionAttachments, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionAttachments.transactionId],
    references: [transactions.id],
  }),
  attachment: one(attachments, {
    fields: [transactionAttachments.attachmentId],
    references: [attachments.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(user, {
    fields: [invoices.userId],
    references: [user.id],
  }),
  card: one(cards, {
    fields: [invoices.cardId],
    references: [cards.id],
  }),
  paymentAccount: one(financialAccounts, {
    fields: [invoices.paymentAccountId],
    references: [financialAccounts.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(user, {
    fields: [budgets.userId],
    references: [user.id],
  }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(user, {
    fields: [notes.userId],
    references: [user.id],
  }),
  items: many(noteItems),
}));

export const noteItemsRelations = relations(noteItems, ({ one }) => ({
  user: one(user, {
    fields: [noteItems.userId],
    references: [user.id],
  }),
  note: one(notes, {
    fields: [noteItems.noteId],
    references: [notes.id],
  }),
}));

export type Account = typeof financialAccounts.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Person = typeof people.$inferSelect;
export type PersonConnection = typeof personConnections.$inferSelect;
export type PersonConnectionInvitation = typeof personConnectionInvitations.$inferSelect;
export type RecurringTransactionRule = typeof recurringTransactionRules.$inferSelect;
export type NewRecurringTransactionRule = typeof recurringTransactionRules.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type ExternalExpense = typeof externalExpenses.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type User = typeof user.$inferSelect;
export type EstablishmentLogo = typeof establishmentLogos.$inferSelect;
