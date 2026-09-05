import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: new URL("../../.env", import.meta.url).pathname });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:7000/openmonetis",
  },
});
