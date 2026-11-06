import type { AiProvider } from "@openmonetis/domain/ai-providers";
import {
  type AiProviderLoginOutput,
  SubmitAiProviderLoginCodeInputSchema,
} from "@openmonetis/validators/ai-providers";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
  CircleCheck,
  Clipboard,
  ClipboardPaste,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { cn } from "@/lib/utils";
import {
  useStartAiProviderLoginMutation,
  useSubmitAiProviderLoginCodeMutation,
} from "../ai-providers.mutations";
import {
  aiProviderErrorMessage,
  aiProviderLabels,
  formatAiLoginTimeLeft,
} from "../ai-providers.presentation";
import { aiProviderLoginQueryOptions } from "../ai-providers.queries";
import { AiProviderMark } from "./ai-provider-mark";

type AiProviderConnectDialogProps = {
  provider: AiProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AiProviderConnectDialog({
  provider,
  open,
  onOpenChange,
}: AiProviderConnectDialogProps) {
  const label = aiProviderLabels[provider];
  const [startedLogin, setStartedLogin] = useState<AiProviderLoginOutput | null>(null);
  const startMutation = useStartAiProviderLoginMutation();
  const consentId = useId();
  const consentForm = useForm({
    defaultValues: { acceptDataSharing: false },
    onSubmitInvalid: showInvalidFormToast,
    validators: {
      onSubmit: ({ value }) =>
        value.acceptDataSharing
          ? undefined
          : { fields: { acceptDataSharing: "Confirme para continuar." } },
    },
    onSubmit: async () => {
      try {
        setStartedLogin(await startMutation.mutateAsync(provider));
      } catch (error) {
        toast.error(aiProviderErrorMessage(error));
      }
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <AiProviderMark provider={provider} size={24} />
            Conectar {label}
          </DialogTitle>
          <DialogDescription className="flex items-start gap-1.5">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            <span>
              O login acontece na página oficial do {label}. O OpenMonetis nunca recebe sua senha.
            </span>
          </DialogDescription>
        </DialogHeader>
        {startedLogin ? (
          <AiProviderLoginSteps
            initialLogin={startedLogin}
            onClose={() => onOpenChange(false)}
            onRestart={() => setStartedLogin(null)}
          />
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void consentForm.handleSubmit();
            }}
          >
            <div className="grid gap-2 rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
              <p className="flex items-center gap-2 font-medium">
                <ShieldCheck aria-hidden="true" className="size-4 text-brand-strong" />O que será
                compartilhado
              </p>
              <p className="text-muted-foreground">
                Por padrão, enviamos ao {label} apenas totais mensais, indicadores, valores por
                categoria e alertas, sem nomes, descrições ou anotações. Você pode liberar mais
                dados em Permissões de dados. O uso conta no limite da sua própria assinatura.
              </p>
            </div>
            <consentForm.Field name="acceptDataSharing">
              {(field) => (
                <div className="grid gap-1">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      aria-invalid={field.state.meta.errors.length > 0}
                      checked={field.state.value}
                      id={consentId}
                      onCheckedChange={(checked) => field.handleChange(checked === true)}
                    />
                    <Label className="font-normal text-sm leading-snug" htmlFor={consentId}>
                      Concordo em enviar ao {label}, com minha assinatura, os dados permitidos nas
                      permissões.
                    </Label>
                  </div>
                  {field.state.meta.errors.length ? (
                    <p className="text-destructive text-sm" role="alert">
                      Confirme para continuar.
                    </p>
                  ) : null}
                </div>
              )}
            </consentForm.Field>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Cancelar
              </Button>
              <consentForm.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? (
                      <LoaderCircle aria-hidden="true" className="animate-spin" />
                    ) : null}
                    {isSubmitting ? "Preparando login…" : "Continuar"}
                  </Button>
                )}
              </consentForm.Subscribe>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AiProviderLoginSteps({
  initialLogin,
  onClose,
  onRestart,
}: {
  initialLogin: AiProviderLoginOutput;
  onClose: () => void;
  onRestart: () => void;
}) {
  const query = useQuery({
    ...aiProviderLoginQueryOptions(initialLogin.provider, initialLogin.loginId),
    initialData: initialLogin,
  });
  const login = query.data;
  const label = aiProviderLabels[login.provider];

  if (login.status === "connected") {
    return (
      <div className="grid gap-4">
        <p className="flex items-center gap-2 font-medium text-sm text-success" role="status">
          <CircleCheck aria-hidden="true" className="size-4" />
          {label} conectado. Você já pode gerar diagnósticos.
        </p>
        <DialogFooter>
          <Button onClick={onClose} type="button">
            Concluir
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (login.status !== "pending") {
    return (
      <div className="grid gap-4">
        <p className="text-sm" role="alert">
          {login.status === "expired"
            ? "O login expirou antes de ser concluído."
            : "Não foi possível concluir o login."}
        </p>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Fechar
          </Button>
          <Button onClick={onRestart} type="button">
            Tentar novamente
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const signInStep = (
    <LoginStep
      description="Use a conta da assinatura que vai gerar os diagnósticos."
      number={1}
      title={`Entre na sua conta do ${label}`}
    >
      {login.verificationUrl ? (
        <Button asChild className="w-full sm:w-fit" variant="outline">
          <a href={login.verificationUrl} rel="noreferrer" target="_blank">
            <ExternalLink aria-hidden="true" />
            Abrir login do {label}
          </a>
        </Button>
      ) : null}
    </LoginStep>
  );

  return (
    <div className="grid gap-5">
      <LoginTimeLeft expiresAt={login.expiresAt} />
      {login.method === "authorizationCode" ? (
        <AuthorizationCodeForm login={login} onCancel={onClose} signInStep={signInStep} />
      ) : (
        <>
          <ol className="grid">
            {signInStep}
            {login.userCode ? (
              <LoginStep
                description="A página vai pedir este código para confirmar o acesso."
                number={2}
                title="Digite o código"
              >
                <DeviceCode code={login.userCode} />
              </LoginStep>
            ) : null}
          </ol>
          <p
            aria-live="polite"
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-muted-foreground text-sm"
          >
            <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" />
            Aguardando a confirmação do login. Esta janela atualiza sozinha.
          </p>
        </>
      )}
    </div>
  );
}

function LoginStep({
  children,
  description,
  number,
  title,
}: {
  children?: ReactNode;
  description: string;
  number: number;
  title: string;
}) {
  return (
    <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-6 before:absolute before:top-9 before:bottom-2 before:left-3.5 before:w-px before:-translate-x-1/2 before:bg-border last:pb-0 last:before:hidden">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-full bg-brand/10 font-mono font-medium text-brand-strong text-xs"
      >
        {number}
      </span>
      <div className="grid min-w-0 gap-3 pt-1">
        <div>
          <p className="font-medium text-sm leading-snug">{title}</p>
          <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{description}</p>
        </div>
        {children}
      </div>
    </li>
  );
}

/** Sign-ins expire on the vendor's clock; short ones (Antigravity gives one minute) need a visible timer. */
function LoginTimeLeft({ expiresAt }: { expiresAt: string }) {
  const secondsLeft = useSecondsUntil(expiresAt);
  const isShort = secondsLeft <= 30;
  return (
    <p
      aria-live={isShort ? "polite" : "off"}
      className={cn(
        "flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs tabular-nums",
        isShort
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Timer aria-hidden="true" className="size-3.5" />
      {secondsLeft > 0
        ? `O login expira em ${formatAiLoginTimeLeft(secondsLeft)}`
        : "Tempo esgotado. Verificando…"}
    </p>
  );
}

function useSecondsUntil(isoDate: string) {
  const deadline = new Date(isoDate).getTime();
  const [now, setNow] = useState(() => Date.now());
  // Ticks against the wall clock, an external system the render cannot derive on its own.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function DeviceCode({ code }: { code: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar. Digite o código manualmente.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-lg tracking-widest select-all">
        {code}
      </code>
      <Button onClick={() => void copy()} type="button" variant="outline">
        <Clipboard aria-hidden="true" />
        Copiar
      </Button>
    </div>
  );
}

function AuthorizationCodeForm({
  login,
  onCancel,
  signInStep,
}: {
  login: AiProviderLoginOutput;
  onCancel: () => void;
  signInStep: ReactNode;
}) {
  const codeId = useId();
  const label = aiProviderLabels[login.provider];
  const submitMutation = useSubmitAiProviderLoginCodeMutation();
  const form = useForm({
    defaultValues: { code: "" },
    onSubmitInvalid: showInvalidFormToast,
    validators: {
      onSubmit: ({ value }) =>
        SubmitAiProviderLoginCodeInputSchema.safeParse(value).success
          ? undefined
          : { fields: { code: "Cole o código do login." } },
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await submitMutation.mutateAsync({
          provider: login.provider,
          loginId: login.loginId,
          code: SubmitAiProviderLoginCodeInputSchema.parse(value).code,
        });
        if (result.status !== "connected") toast.error("O código não foi aceito.");
      } catch (error) {
        toast.error(aiProviderErrorMessage(error));
      }
    },
  });

  async function pasteCode(setCode: (code: string) => void) {
    try {
      setCode((await navigator.clipboard.readText()).trim());
    } catch {
      toast.error("Não foi possível colar. Cole o código manualmente.");
    }
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <ol className="grid">
        {signInStep}
        <LoginStep
          description="Ao terminar o login, a página mostra um código. Copie e cole aqui."
          number={2}
          title="Cole o código do login"
        >
          <form.Field name="code">
            {(field) => (
              <div className="grid gap-2">
                <Label className="sr-only" htmlFor={codeId}>
                  Código do login
                </Label>
                <InputGroup>
                  <InputGroupInput
                    aria-describedby={
                      field.state.meta.errors.length ? `${codeId}-error` : undefined
                    }
                    aria-invalid={field.state.meta.errors.length > 0}
                    autoComplete="off"
                    className="font-mono"
                    disabled={submitMutation.isPending}
                    id={codeId}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Cole o código aqui"
                    spellCheck={false}
                    value={field.state.value}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      disabled={submitMutation.isPending}
                      onClick={() => void pasteCode(field.handleChange)}
                    >
                      <ClipboardPaste aria-hidden="true" />
                      Colar
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {field.state.meta.errors.length ? (
                  <p className="text-destructive text-sm" id={`${codeId}-error`} role="alert">
                    Cole o código do login.
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>
        </LoginStep>
      </ol>
      <DialogFooter>
        <Button
          disabled={submitMutation.isPending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {isSubmitting ? "Conectando…" : `Conectar ${label}`}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
