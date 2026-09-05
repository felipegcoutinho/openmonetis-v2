import assert from "node:assert/strict";
import test from "node:test";
import { ChangePasswordInputSchema, SignupFormInputSchema } from "@openmonetis/validators/auth";

test("accepts matching signup passwords", () => {
  assert.equal(
    SignupFormInputSchema.safeParse({
      name: "Felipe",
      email: "felipe@example.com",
      password: "password-123",
      passwordConfirmation: "password-123",
    }).success,
    true,
  );
});

test("rejects a signup password confirmation mismatch", () => {
  const result = SignupFormInputSchema.safeParse({
    name: "Felipe",
    email: "felipe@example.com",
    password: "password-123",
    passwordConfirmation: "different-123",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["passwordConfirmation"]);
  }
});

test("accepts a valid password change", () => {
  assert.equal(
    ChangePasswordInputSchema.safeParse({
      currentPassword: "password-123",
      newPassword: "new-password-456",
      passwordConfirmation: "new-password-456",
    }).success,
    true,
  );
});

test("rejects an unchanged password and a confirmation mismatch", () => {
  const unchanged = ChangePasswordInputSchema.safeParse({
    currentPassword: "password-123",
    newPassword: "password-123",
    passwordConfirmation: "password-123",
  });
  const mismatch = ChangePasswordInputSchema.safeParse({
    currentPassword: "password-123",
    newPassword: "new-password-456",
    passwordConfirmation: "different-123",
  });

  assert.equal(unchanged.success, false);
  assert.equal(mismatch.success, false);
  if (!unchanged.success) assert.deepEqual(unchanged.error.issues[0]?.path, ["newPassword"]);
  if (!mismatch.success) {
    assert.deepEqual(mismatch.error.issues[0]?.path, ["passwordConfirmation"]);
  }
});
