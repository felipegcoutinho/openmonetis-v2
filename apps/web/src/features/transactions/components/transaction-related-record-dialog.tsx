import type { AccountOutput, CreateAccountInput } from "@openmonetis/validators/accounts";
import type { CreateCardInput } from "@openmonetis/validators/cards";
import type { CreateCategoryInput } from "@openmonetis/validators/categories";
import type { CreatePersonInput } from "@openmonetis/validators/people";
import { useCreateAccountMutation } from "@/features/accounts/accounts.mutations";
import { AccountDialog } from "@/features/accounts/components/account-dialog";
import { useCreateCardMutation } from "@/features/cards/cards.mutations";
import { CardDialog } from "@/features/cards/components/card-dialog";
import { useCreateCategoryMutation } from "@/features/categories/categories.mutations";
import { CategoryDialog } from "@/features/categories/components/category-dialog";
import { PersonDialog } from "@/features/people/components/person-dialog";
import { useCreatePersonMutation } from "@/features/people/people.mutations";

export type TransactionRelatedRecordKind = "account" | "card" | "category" | "person";

export function TransactionRelatedRecordDialog({
  kind,
  accounts,
  categoryType,
  onClose,
  onCreated,
}: {
  kind: TransactionRelatedRecordKind | null;
  accounts: AccountOutput[];
  categoryType?: CreateCategoryInput["type"];
  onClose: () => void;
  onCreated: (kind: TransactionRelatedRecordKind, id: string) => void;
}) {
  const account = useCreateAccountMutation();
  const card = useCreateCardMutation();
  const category = useCreateCategoryMutation();
  const person = useCreatePersonMutation();
  const changeOpen = (open: boolean) => {
    if (!open) onClose();
  };
  if (kind === "account")
    return (
      <AccountDialog
        account={null}
        open
        onOpenChange={changeOpen}
        onSubmit={async (input) => {
          const result = await account.mutateAsync(input as CreateAccountInput);
          onCreated(kind, result.id);
        }}
      />
    );
  if (kind === "card")
    return (
      <CardDialog
        accounts={accounts}
        card={null}
        open
        onOpenChange={changeOpen}
        onSubmit={async (input) => {
          const result = await card.mutateAsync(input as CreateCardInput);
          onCreated(kind, result.id);
        }}
      />
    );
  if (kind === "category")
    return (
      <CategoryDialog
        category={null}
        defaultType={categoryType}
        open
        onOpenChange={changeOpen}
        onSubmit={async (input) => {
          const result = await category.mutateAsync(input as CreateCategoryInput);
          onCreated(kind, result.id);
        }}
      />
    );
  if (kind === "person")
    return (
      <PersonDialog
        person={null}
        open
        onOpenChange={changeOpen}
        onSubmit={async (input) => {
          const result = await person.mutateAsync(input as CreatePersonInput);
          onCreated(kind, result.id);
        }}
      />
    );
  return null;
}
