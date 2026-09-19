import { LoginInputSchema } from "@openmonetis/validators/auth";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Fingerprint, LogIn } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { usePasskeySupport } from "@/hooks/usePasskeySupport";
import { authClient } from "@/lib/auth-client";
import { GoogleAuthButton } from "./google-auth-button";

export function LoginForm() {
  const navigate = useNavigate();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false);
  const passkeySupported = usePasskeySupport();
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const input = LoginInputSchema.safeParse(value);
      if (!input.success) {
        setError("Revise o e-mail e a senha.");
        return;
      }

      const result = await authClient.signIn
        .email({
          ...input.data,
          callbackURL: "/dashboard",
        })
        .catch(() => null);
      if (!result) {
        setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
        return;
      }

      if (result.error) {
        const message =
          result.error.status === 429
            ? "Muitas tentativas. Aguarde um pouco e tente novamente."
            : result.error.status >= 500
              ? "O serviço está indisponível. Tente novamente em instantes."
              : "E-mail ou senha inválidos.";
        setError(message);
        toast.error("Não foi possível entrar.", { description: message });
        return;
      }

      toast.success("Acesso realizado");
      await navigate({ to: "/dashboard" });
    },
  });

  async function handlePasskeySignIn() {
    setError(null);
    setIsPasskeySubmitting(true);

    try {
      const result = await authClient.signIn.passkey();
      if (result.error) {
        const message = "Não foi possível entrar com a chave de acesso. Tente novamente.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("Acesso realizado");
      await navigate({ to: "/dashboard" });
    } catch {
      const message = "A confirmação da chave de acesso foi cancelada ou não pôde ser concluída.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPasskeySubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleSubmitting(true);

    try {
      const origin = window.location.origin;
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: new URL("/dashboard", origin).toString(),
        errorCallbackURL: new URL("/", origin).toString(),
      });

      if (result.error) {
        const message = "Não foi possível entrar com o Google. Tente novamente.";
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
        name="email"
        validators={{
          onBlur: ({ value }) =>
            LoginInputSchema.shape.email.safeParse(value).success
              ? undefined
              : "Informe um e-mail válido.",
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-email`}>E-mail</Label>
            <Input
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="username webauthn"
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
            LoginInputSchema.shape.password.safeParse(value).success
              ? undefined
              : "Informe uma senha com pelo menos 8 caracteres.",
        }}
      >
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-password`}>Senha</Label>
            <PasswordInput
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="current-password"
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
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            disabled={isSubmitting || isGoogleSubmitting || isPasskeySubmitting}
            type="submit"
          >
            <LogIn aria-hidden="true" className="size-4" />
            {isSubmitting ? "Entrando" : "Entrar"}
          </Button>
        )}
      </form.Subscribe>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Não consegue acessar?</summary>
        <p className="mt-2 text-muted-foreground">
          Tente o Google ou uma chave de acesso já vinculados à sua conta. Se você usa somente
          senha, contate quem administra esta instalação para recuperar o acesso.
        </p>
      </details>
      <div className="relative flex items-center py-1" aria-hidden="true">
        <div className="grow border-t border-border" />
        <span className="px-3 text-muted-foreground text-xs uppercase">ou</span>
        <div className="grow border-t border-border" />
      </div>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <GoogleAuthButton
            disabled={isSubmitting || isPasskeySubmitting}
            isLoading={isGoogleSubmitting}
            onClick={handleGoogleSignIn}
          />
        )}
      </form.Subscribe>
      {passkeySupported ? (
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              disabled={isSubmitting || isGoogleSubmitting || isPasskeySubmitting}
              onClick={handlePasskeySignIn}
              type="button"
              variant="outline"
            >
              <Fingerprint aria-hidden="true" className="size-4" />
              {isPasskeySubmitting ? "Confirmando..." : "Entrar com chave de acesso"}
            </Button>
          )}
        </form.Subscribe>
      ) : null}
    </form>
  );
}
