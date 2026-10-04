import type {
  AccountOutput,
  CreateAccountInput,
  ReplaceAccountInput,
} from "@openmonetis/validators/accounts";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountForm } from "./account-form";

type AccountDialogProps = {
  account: AccountOutput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateAccountInput | ReplaceAccountInput) => Promise<void>;
};

export function AccountDialog({ account, open, onOpenChange, onSubmit }: AccountDialogProps) {
  const isEditing = Boolean(account);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent guarded className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Atualizar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações da conta selecionada."
              : "Cadastre uma nova conta para organizar seus lançamentos."}
          </DialogDescription>
        </DialogHeader>
        <AccountForm
          key={account?.id ?? "new-account"}
          account={account}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
