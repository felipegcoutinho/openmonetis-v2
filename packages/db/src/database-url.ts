type DatabaseEnvironment = Record<string, string | undefined>;

function encodeConnectionValue(value: string) {
  return encodeURIComponent(value);
}

export function resolveDatabaseUrl(environment: DatabaseEnvironment = process.env) {
  const configuredDatabaseUrl = environment.DATABASE_URL?.trim();
  if (environment.NODE_ENV === "production") {
    if (configuredDatabaseUrl) return configuredDatabaseUrl;

    throw new Error("DATABASE_URL is required in production");
  }

  const externalDatabaseUrl = environment.EXTERNAL_DATABASE_URL?.trim();
  if (externalDatabaseUrl) return externalDatabaseUrl;

  const database = encodeConnectionValue(environment.POSTGRES_DB?.trim() || "openmonetis");
  const password = encodeConnectionValue(environment.POSTGRES_PASSWORD?.trim() || "postgres");
  const port = environment.DB_HOST_PORT?.trim() || "7000";
  const user = encodeConnectionValue(environment.POSTGRES_USER?.trim() || "postgres");

  return `postgres://${user}:${password}@localhost:${port}/${database}`;
}
