import type { AccountOutput } from "@openmonetis/validators/accounts";
import { AccountCard } from "./account-card";

type AccountsGridProps = {
  accounts: AccountOutput[];
  onArchive?: (account: AccountOutput) => Promise<void>;
  onDelete?: (account: AccountOutput) => Promise<void>;
  onEdit: (account: AccountOutput) => void;
  pendingAccountId?: string | null;
};

export function AccountsGrid({
  accounts,
  onArchive,
  onDelete,
  onEdit,
  pendingAccountId,
}: AccountsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard
          account={account}
          key={account.id}
          onArchive={onArchive}
          onDelete={onDelete}
          onEdit={onEdit}
          pending={pendingAccountId === account.id}
        />
      ))}
    </div>
  );
}
