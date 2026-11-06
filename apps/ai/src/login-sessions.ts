import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AiProviderLoginStatus } from "@openmonetis/domain/ai-providers";
import type { ProviderAdapter } from "./providers/provider";
import { startInteractiveCommand, stopProcess } from "./utils/process";

const loginLifetimeMs = 15 * 60_000;
const promptTimeoutMs = 30_000;
const codeConfirmationTimeoutMs = 60_000;
const settledRetentionMs = 10 * 60_000;
const maximumBufferedOutput = 64 * 1024;

export type LoginSnapshot = {
  loginId: string;
  provider: ProviderAdapter["provider"];
  method: ProviderAdapter["loginMethod"];
  status: AiProviderLoginStatus;
  verificationUrl: string | null;
  userCode: string | null;
  expiresAt: string;
};

type LoginSession = Omit<LoginSnapshot, "expiresAt"> & {
  ownerKey: string;
  expiresAt: Date;
  child: ChildProcessWithoutNullStreams;
  settled: Promise<void>;
};

/**
 * Sign-ins in progress. Each one is the vendor CLI's own login running in the user's home; this
 * registry only relays the link, the one-time code and, for Claude, the code the person pastes.
 */
export function createLoginSessions(now: () => Date = () => new Date()) {
  const sessions = new Map<string, LoginSession>();

  function snapshot(session: LoginSession): LoginSnapshot {
    return {
      loginId: session.loginId,
      provider: session.provider,
      method: session.method,
      status: session.status,
      verificationUrl: session.status === "pending" ? session.verificationUrl : null,
      userCode: session.status === "pending" ? session.userCode : null,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  function purgeSettled() {
    const threshold = now().getTime() - settledRetentionMs;
    for (const [id, session] of sessions) {
      if (session.status !== "pending" && session.expiresAt.getTime() < threshold) {
        sessions.delete(id);
      }
    }
  }

  return {
    /** `onSettled` runs once the sign-in process has ended, however it ended. */
    async start(
      ownerKey: string,
      home: string,
      adapter: ProviderAdapter,
      onSettled?: () => void,
    ): Promise<LoginSnapshot> {
      purgeSettled();
      for (const session of sessions.values()) {
        if (session.ownerKey === ownerKey && session.status === "pending") {
          session.status = "failed";
          stopProcess(session.child);
        }
      }

      const lifetimeMs = adapter.loginLifetimeMs ?? loginLifetimeMs;
      const { command, args, env } = adapter.loginCommand(home);
      const child = startInteractiveCommand(command, args, { env, cwd: home });
      let output = "";
      let resolvePrompt: () => void = () => undefined;
      const prompted = new Promise<void>((resolve) => {
        resolvePrompt = resolve;
      });
      const session: LoginSession = {
        loginId: randomUUID(),
        ownerKey,
        provider: adapter.provider,
        method: adapter.loginMethod,
        status: "pending",
        verificationUrl: null,
        userCode: null,
        expiresAt: new Date(now().getTime() + lifetimeMs),
        child,
        settled: new Promise<void>((resolve) => {
          child.on("close", async (exitCode) => {
            // Ends any helper still reading the sign-in's input, such as the `cat` feeding `script`.
            child.stdin.destroy();
            if (session.status === "pending") {
              session.status =
                exitCode === 0 && (await adapter.readAccount(home)) ? "connected" : "failed";
            }
            resolvePrompt();
            resolve();
          });
          child.on("error", () => {
            if (session.status === "pending") session.status = "failed";
            resolvePrompt();
            resolve();
          });
        }),
      };
      const readOutput = (chunk: Buffer) => {
        if (output.length < maximumBufferedOutput) output += chunk.toString("utf8");
        const prompt = adapter.parseLoginPrompt(output);
        if (prompt) {
          session.verificationUrl = prompt.verificationUrl;
          session.userCode = prompt.userCode;
          resolvePrompt();
        }
      };
      child.stdout.on("data", readOutput);
      child.stderr.on("data", readOutput);
      sessions.set(session.loginId, session);
      if (onSettled) void session.settled.then(onSettled);

      const expiry = setTimeout(() => {
        if (session.status !== "pending") return;
        session.status = "expired";
        stopProcess(child);
      }, lifetimeMs);
      expiry.unref();
      void session.settled.then(() => clearTimeout(expiry));

      await Promise.race([prompted, delay(promptTimeoutMs)]);
      if (session.status === "pending" && !session.verificationUrl) {
        session.status = "failed";
        stopProcess(child);
      }
      return snapshot(session);
    },

    get(ownerKey: string, loginId: string): LoginSnapshot | null {
      const session = sessions.get(loginId);
      return session && session.ownerKey === ownerKey ? snapshot(session) : null;
    },

    async submitCode(ownerKey: string, loginId: string, code: string) {
      const session = sessions.get(loginId);
      if (!session || session.ownerKey !== ownerKey) return null;
      if (session.status !== "pending" || session.method !== "authorizationCode") {
        return snapshot(session);
      }
      session.child.stdin.write(`${code.trim()}\n`);
      await Promise.race([session.settled, delay(codeConfirmationTimeoutMs)]);
      if (session.status === "pending") {
        session.status = "failed";
        stopProcess(session.child);
      }
      return snapshot(session);
    },

    cancelAll(ownerKey: string) {
      for (const session of sessions.values()) {
        if (session.ownerKey === ownerKey && session.status === "pending") {
          session.status = "failed";
          stopProcess(session.child);
        }
      }
    },
  };
}

export type LoginSessions = ReturnType<typeof createLoginSessions>;

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds).unref());
}
