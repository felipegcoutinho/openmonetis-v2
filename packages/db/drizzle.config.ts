import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./src/database-url";

config({ path: new URL("../../.env", import.meta.url).pathname });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
