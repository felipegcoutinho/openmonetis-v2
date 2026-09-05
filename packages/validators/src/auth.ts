import { z } from "@hono/zod-openapi";

export const PasswordSchema = z.string().min(8).max(128);

export const LoginInputSchema = z.object({
  email: z.email().max(320),
  password: PasswordSchema,
});

export const SignupInputSchema = LoginInputSchema.extend({
  name: z.string().trim().min(1).max(120),
});

export const SignupFormInputSchema = SignupInputSchema.extend({
  passwordConfirmation: PasswordSchema,
}).refine((input) => input.password === input.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

export const ChangePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: PasswordSchema,
    passwordConfirmation: PasswordSchema,
  })
  .strict()
  .refine((input) => input.newPassword === input.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "New password must differ from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
