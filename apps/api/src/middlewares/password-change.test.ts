import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthMiddleware } from "better-auth/api";
import { enforcePasswordChangePolicy } from "./password-change";

const baseURL = "http://localhost:7001";
const requestHeaders = { "content-type": "application/json", origin: baseURL };

function createTestAuth() {
  const database: Record<string, unknown[]> = {
    account: [],
    session: [],
    user: [],
    verification: [],
  };
  const auth = betterAuth({
    baseURL,
    secret: "password-change-test-secret-at-least-32-characters",
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        const policy = enforcePasswordChangePolicy(context);
        if (policy) return policy;
      }),
    },
  });
  return { auth, database };
}

async function post(
  auth: { handler(request: Request): Promise<Response> },
  path: string,
  body: Record<string, unknown>,
  cookie?: string,
) {
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth${path}`, {
      method: "POST",
      headers: cookie ? { ...requestHeaders, cookie } : requestHeaders,
      body: JSON.stringify(body),
    }),
  );
  return { response, payload: (await response.json()) as { code?: string } };
}

function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

test("password policy rejects an unchanged password at the endpoint", async () => {
  const { auth, database } = createTestAuth();
  const signup = await post(auth, "/sign-up/email", {
    name: "Test user",
    email: "unchanged@example.test",
    password: "current-password-123",
  });

  const result = await post(
    auth,
    "/change-password",
    {
      currentPassword: "current-password-123",
      newPassword: "current-password-123",
      revokeOtherSessions: false,
    },
    sessionCookie(signup.response),
  );

  assert.equal(result.response.status, 400);
  assert.equal(result.payload.code, "PASSWORD_UNCHANGED");
  assert.equal(database.session?.length, 1);
});

test("password policy always revokes other sessions and preserves the changed login", async () => {
  const { auth, database } = createTestAuth();
  const signup = await post(auth, "/sign-up/email", {
    name: "Test user",
    email: "sessions@example.test",
    password: "current-password-123",
  });
  const secondLogin = await post(auth, "/sign-in/email", {
    email: "sessions@example.test",
    password: "current-password-123",
  });
  assert.equal(secondLogin.response.status, 200);
  assert.equal(database.session?.length, 2);

  const changed = await post(
    auth,
    "/change-password",
    {
      currentPassword: "current-password-123",
      newPassword: "new-password-456",
      revokeOtherSessions: false,
    },
    sessionCookie(signup.response),
  );

  assert.equal(changed.response.status, 200);
  assert.equal(database.session?.length, 1);

  const oldPasswordLogin = await post(auth, "/sign-in/email", {
    email: "sessions@example.test",
    password: "current-password-123",
  });
  const newPasswordLogin = await post(auth, "/sign-in/email", {
    email: "sessions@example.test",
    password: "new-password-456",
  });
  assert.equal(oldPasswordLogin.response.status, 401);
  assert.equal(newPasswordLogin.response.status, 200);
});

test("Google-only accounts cannot change a password", async () => {
  const { auth, database } = createTestAuth();
  const signup = await post(auth, "/sign-up/email", {
    name: "Google user",
    email: "google@example.test",
    password: "current-password-123",
  });
  const credential = database.account?.[0] as
    | { password?: string | null; providerId?: string }
    | undefined;
  assert.ok(credential);
  credential.providerId = "google";
  credential.password = null;

  const result = await post(
    auth,
    "/change-password",
    {
      currentPassword: "current-password-123",
      newPassword: "new-password-456",
    },
    sessionCookie(signup.response),
  );

  assert.equal(result.response.status, 400);
  assert.equal(result.payload.code, "CREDENTIAL_ACCOUNT_NOT_FOUND");
});
