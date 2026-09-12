import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const envDir = "../..";

function isExpectedClientDisconnect(error: unknown) {
  if (!(error instanceof Error)) return false;

  const httpError = error as Error & {
    cause?: unknown;
    status?: unknown;
    unhandled?: unknown;
  };
  if (httpError.message !== "aborted" || httpError.status !== 500 || httpError.unhandled !== true) {
    return false;
  }

  const cause = httpError.cause;
  return cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ECONNRESET";
}

function ignoreExpectedClientDisconnects(): Plugin {
  return {
    name: "openmonetis:ignore-expected-client-disconnects",
    apply: "serve",
    configureServer(server) {
      const originalError = console.error;
      const filteredError = (...args: unknown[]) => {
        if (!isExpectedClientDisconnect(args[0])) originalError(...args);
      };

      console.error = filteredError;
      server.httpServer?.once("close", () => {
        if (console.error === filteredError) console.error = originalError;
      });
    },
  };
}

const config = defineConfig(({ mode }) => {
  const localEnvironment = loadEnv(mode, envDir, "");
  for (const name of ["S3_BUCKET", "S3_ENDPOINT", "S3_REGION"] as const) {
    if (!process.env[name] && localEnvironment[name]) {
      process.env[name] = localEnvironment[name];
    }
  }

  return {
    envDir,
    resolve: { tsconfigPaths: true },
    plugins: [
      ignoreExpectedClientDisconnects(),
      devtools(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (/node_modules\/canvas-confetti\//.test(id)) return "confetti";
            if (/node_modules\/recharts\//.test(id)) return "charts";
            if (/node_modules\/@tanstack\/[^/]+\//.test(id)) return "tanstack";
            if (/node_modules\/@better-auth\/[^/]+\//.test(id)) return "passkey-authentication";
            if (/node_modules\/better-auth\//.test(id)) return "authentication";
            if (/node_modules\/(?:react|react-dom|scheduler)\//.test(id)) return "react";
            if (
              /node_modules\/(?:@base-ui\/[^/]+|@radix-ui\/[^/]+|lucide-react|react-day-picker|date-fns)\//.test(
                id,
              )
            ) {
              return "ui-vendor";
            }
            return "vendor";
          },
        },
      },
    },
  };
});

export default config;
