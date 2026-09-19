import {
  DeleteSettingsAccountInputSchema,
  ResetSettingsInputSchema,
  settingsConfirmation,
} from "@openmonetis/validators/settings";
import { useForm } from "@tanstack/react-form";
import { Trash2, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { SettingsPanel, SettingsSection } from "@/components/settings-panel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteSettingsAccountMutation, useResetSettingsMutation } from "../settings.mutations";
import { settingsMutationErrorMessage } from "../settings.presentation";

type DangerousAction = "reset" | "delete";

const actionContent = {
  reset: {
    title: "Apagar dados financeiros",
    dialogTitle: "Apagar todos os dados financeiros?",
    description:
      "Recomece seu controle financeiro mantendo o acesso. A exclusão dos dados é permanente.",
    dialogDescription:
      "Lançamentos, contas, cartões, anexos, pendências externas e demais dados financeiros serão removidos de forma permanente. Lançamentos já importados por outra pessoa permanecem na conta dela, e conexões ativas serão encerradas.",
    confirmation: settingsConfirmation.reset,
    submitLabel: "Apagar dados financeiros",
    pendingLabel: "Zerando...",
    successMessage: "Dados zerados",
  },
  delete: {
    title: "Excluir minha conta de acesso",
    dialogTitle: "Excluir sua conta de acesso?",
    description:
      "Encerre seu acesso ao OpenMonetis de forma permanente. Para voltar, será necessário um novo cadastro.",
    dialogDescription:
      "Seu acesso, credenciais, lançamentos, pendências externas e arquivos serão removidos permanentemente. Lançamentos já importados por outra pessoa permanecem na conta dela.",
    confirmation: settingsConfirmation.delete,
    submitLabel: "Excluir meu acesso",
    pendingLabel: "Excluindo...",
    successMessage: "Conta excluída",
  },
} as const;

export function SettingsDangerZone() {
  const [action, setAction] = useState<DangerousAction | null>(null);

  function finish(currentAction: DangerousAction) {
    toast.success(actionContent[currentAction].successMessage);
    window.location.assign(currentAction === "reset" ? "/dashboard" : "/");
  }

  return (
    <SettingsPanel>
      <DangerousActionSection
        action="reset"
        removed={[
          "Lançamentos, recorrências, contas, cartões e orçamentos",
          "Anexos e pendências externas; conexões ativas são encerradas",
        ]}
        retained={[
          "Nome, e-mail, senha e sessão",
          "Histórico já importado por outras pessoas nas contas delas",
        ]}
        note="A pessoa principal e as categorias padrão serão recriadas."
        icon={Trash2}
        onSelect={setAction}
      />
      <DangerousActionSection
        action="delete"
        removed={[
          "Todos os seus dados financeiros, anexos e configurações",
          "Seu perfil e as credenciais de acesso",
        ]}
        retained={[
          "Histórico já importado por outras pessoas, de forma anonimizada nas contas delas",
        ]}
        icon={Trash2}
        onSelect={setAction}
      />

      {action ? (
        <DangerousActionDialog
          action={action}
          key={action}
          onComplete={() => finish(action)}
          onOpenChange={(open) => {
            if (!open) setAction(null);
          }}
        />
      ) : null}
    </SettingsPanel>
  );
}

function DangerousActionSection({
  action,
  removed,
  retained,
  note,
  icon: Icon,
  onSelect,
}: {
  action: DangerousAction;
  removed: string[];
  retained: string[];
  note?: string;
  icon: typeof Trash2;
  onSelect: (action: DangerousAction) => void;
}) {
  const content = actionContent[action];

  return (
    <SettingsSection
      className={action === "delete" ? "border-b-0" : undefined}
      contentClassName="grid gap-5"
      description={content.description}
      icon={Icon}
      title={content.title}
      variant="destructive"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          { title: "O que será apagado", items: removed },
          { title: "O que será mantido", items: retained },
        ].map((group) => (
          <div key={group.title}>
            <h3 className="font-medium text-sm">{group.title}</h3>
            <ul className="mt-2 grid gap-2 text-muted-foreground text-sm leading-relaxed">
              {group.items.map((detail) => (
                <li className="flex gap-2" key={detail}>
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1 shrink-0 rounded-full bg-current"
                  />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {note ? <p className="text-muted-foreground text-sm">{note}</p> : null}
      <Button
        className="w-full sm:w-fit"
        onClick={() => onSelect(action)}
        type="button"
        variant={action === "delete" ? "destructive" : "outline"}
      >
        <Icon aria-hidden="true" className="size-4" />
        {content.submitLabel}
      </Button>
    </SettingsSection>
  );
}

function DangerousActionDialog({
  action,
  onComplete,
  onOpenChange,
}: {
  action: DangerousAction;
  onComplete: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const inputId = useId();
  const resetMutation = useResetSettingsMutation();
  const deleteMutation = useDeleteSettingsAccountMutation();
  const content = actionContent[action];
  const mutation = action === "reset" ? resetMutation : deleteMutation;
  const form = useForm({
    defaultValues: { confirmation: "" },
    onSubmit: async ({ value }) => {
      const schema =
        action === "reset" ? ResetSettingsInputSchema : DeleteSettingsAccountInputSchema;
      const result = schema.safeParse(value);
      if (!result.success) return;

      try {
        if (action === "reset") {
          await resetMutation.mutateAsync(result.data as { confirmation: "ZERAR" });
        } else {
          await deleteMutation.mutateAsync(result.data as { confirmation: "EXCLUIR" });
        }
        onComplete();
      } catch (error) {
        toast.error(settingsMutationErrorMessage(error));
      }
    },
  });

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!mutation.isPending) onOpenChange(open);
      }}
      open
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TriangleAlert aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>{content.dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{content.dialogDescription}</AlertDialogDescription>
        </AlertDialogHeader>

        <form
          className="grid gap-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="confirmation">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.value !== content.confirmation;

              return (
                <div className="grid gap-2">
                  <Label
                    className="normal-case font-sans text-sm tracking-normal"
                    htmlFor={inputId}
                  >
                    Digite <strong>{content.confirmation}</strong> para confirmar
                  </Label>
                  <Input
                    aria-describedby={`${inputId}-hint`}
                    aria-invalid={isInvalid}
                    autoComplete="off"
                    autoFocus
                    disabled={mutation.isPending}
                    id={inputId}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={content.confirmation}
                    value={field.state.value}
                  />
                  <p className="text-muted-foreground text-xs" id={`${inputId}-hint`}>
                    A confirmação diferencia maiúsculas de minúsculas.
                  </p>
                </div>
              );
            }}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.values.confirmation, state.isSubmitting] as const}
          >
            {([confirmation, isSubmitting]) => (
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                <Button
                  disabled={isSubmitting || confirmation !== content.confirmation}
                  type="submit"
                  variant="destructive"
                >
                  {isSubmitting ? content.pendingLabel : content.submitLabel}
                </Button>
              </AlertDialogFooter>
            )}
          </form.Subscribe>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
