import { APIError } from "better-auth/api";

export function enforcePasswordChangePolicy(context: { body?: unknown; path: string }) {
  if (context.path !== "/change-password") return;

  const body = context.body;
  if (!body || typeof body !== "object") return;

  const currentPassword = "currentPassword" in body ? body.currentPassword : undefined;
  const newPassword = "newPassword" in body ? body.newPassword : undefined;

  if (
    typeof currentPassword === "string" &&
    typeof newPassword === "string" &&
    currentPassword === newPassword
  ) {
    throw new APIError("BAD_REQUEST", {
      code: "PASSWORD_UNCHANGED",
      message: "New password must differ from current password",
    });
  }

  return {
    context: {
      body: {
        ...body,
        revokeOtherSessions: true,
      },
    },
  };
}
