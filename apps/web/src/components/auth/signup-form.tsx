import {
  PasswordSchema,
  SignupFormInputSchema,
  SignupInputSchema,
} from "@openmonetis/validators/auth";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { GoogleAuthButton } from "./google-auth-button";

function getSignupErrorMessage(error: unknown) {
  const details =
    error && typeof error === "object"
      ? {
          code: "code" in error && typeof error.code === "string" ? error.code : "",
          message: "message" in error && typeof error.message === "string" ? error.message : "",
          status: "status" in error && typeof error.status === "number" ? error.status : 0,
        }
      : { code: "", message: "", status: 0 };
  const identifier = `${details.code} ${details.message}`.toLowerCase();

  if (details.status === 429 || identifier.includes("rate") || identifier.includes("too many")) {
    return "Muitas tentativas de cadastro. Aguarde um minuto e tente novamente.";
  }

  if (identifier.includes("already exists") || identifier.includes("already_exists")) {
    return "Este e-mail já possui uma conta. Entre ou use outro e-mail.";
  }

  if (identifier.includes("password")) {
    return "Use uma senha entre 8 e 128 caracteres.";
  }

  return "Não foi possível criar sua conta. Verifique os dados e tente novamente.";
}

export function SignupForm() {
  const navigate = useNavigate();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const form = useForm({
    defaultValues: { name: "", email: "", password: "", passwordConfirmation: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const input = SignupFormInputSchema.safeParse(value);
      if (!input.success) {
        setError("Revise os dados do cadastro.");
        return;
      }

      try {
        const result = await authClient.signUp.email({
          name: input.data.name,
          email: input.data.email,
          password: input.data.password,
          callbackURL: "/dashboard",
        });

        if (result.error) {
          const message = getSignupErrorMessage(result.error);
          setError(message);
          toast.error(message);
          return;
        }

        toast.success("Conta criada", { description: "Seu acesso está pronto." });
        await navigate({ to: "/dashboard" });
      } catch {
        const message = "Não foi possível conectar ao servidor. Tente novamente em instantes.";
        setError(message);
        toast.error(message);
      }
    },
  });

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleSubmitting(true);

    try {
      const origin = window.location.origin;
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: new URL("/dashboard", origin).toString(),
        errorCallbackURL: new URL("/signup", origin).toString(),
      });

      if (result.error) {
        const message = "Não foi possível criar sua conta com o Google. Tente novamente.";
        setError(message);
        setIsGoogleSubmitting(false);
        toast.error(message);
      }
    } catch {
      const message = "Não foi possível conectar ao Google. Tente novamente em instantes.";
      setError(message);
      setIsGoogleSubmitting(false);
      toast.error(message);
    }
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="name"
        validators={{
          onBlur: ({ value }) =>
            SignupInputSchema.shape.name.safeParse(value).success ? undefined : "Informe seu nome.",
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-name`}>Nome</Label>
            <Input
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="name"
              id={`${id}-name`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-destructive text-xs">{field.state.meta.errors[0]}</p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field
        name="email"
        validators={{
          onBlur: ({ value }) =>
            SignupInputSchema.shape.email.safeParse(value).success
              ? undefined
              : "Informe um e-mail válido.",
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-email`}>E-mail</Label>
            <Input
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="email"
              id={`${id}-email`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              type="email"
              value={field.state.value}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-destructive text-xs">{field.state.meta.errors[0]}</p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field
        name="password"
        validators={{
          onBlur: ({ value }) =>
            SignupInputSchema.shape.password.safeParse(value).success
              ? undefined
              : "Use uma senha entre 8 e 128 caracteres.",
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-password`}>Senha</Label>
            <p id={`${id}-password-help`} className="text-muted-foreground text-xs">
              Use de 8 a 128 caracteres.
            </p>
            <PasswordInput
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="new-password"
              aria-describedby={`${id}-password-help`}
              id={`${id}-password`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-destructive text-xs">{field.state.meta.errors[0]}</p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field
        name="passwordConfirmation"
        validators={{
          onBlur: ({ value }) => {
            if (!PasswordSchema.safeParse(value).success) {
              return "Confirme a senha informada.";
            }
            return value === form.getFieldValue("password")
              ? undefined
              : "As senhas não coincidem.";
          },
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-password-confirmation`}>Confirmar senha</Label>
            <PasswordInput
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="new-password"
              aria-describedby={`${id}-password-help`}
              id={`${id}-password-confirmation`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-destructive text-xs">{field.state.meta.errors[0]}</p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button disabled={isSubmitting || isGoogleSubmitting} type="submit">
            <UserPlus aria-hidden="true" className="size-4" />
            {isSubmitting ? "Criando" : "Criar conta"}
          </Button>
        )}
      </form.Subscribe>
      {error ? (
        <div className="grid gap-1 text-destructive text-sm" role="alert">
          <p>{error}</p>
          {error.startsWith("Este e-mail já") ? (
            <Link className="font-medium underline" to="/">
              Entrar na minha conta
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="relative flex items-center py-1" aria-hidden="true">
        <div className="grow border-t border-border" />
        <span className="px-3 text-muted-foreground text-xs uppercase">ou</span>
        <div className="grow border-t border-border" />
      </div>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <GoogleAuthButton
            disabled={isSubmitting}
            isLoading={isGoogleSubmitting}
            onClick={handleGoogleSignIn}
          />
        )}
      </form.Subscribe>
    </form>
  );
}
