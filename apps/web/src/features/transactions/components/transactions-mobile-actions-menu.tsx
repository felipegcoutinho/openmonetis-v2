import { useNavigate } from "@tanstack/react-router";
import { Ellipsis, FileSpreadsheet, FileText, FileUp, ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TransactionsScreenProps } from "./transactions-screen.types";

export type TransactionsMobileExport = {
  onExport: NonNullable<TransactionsScreenProps["onExport"]>;
  pending: boolean;
  disabled: boolean;
};

export function TransactionsMobileActionsMenu({
  allowImport,
  exportOptions,
  onSelect,
}: {
  allowImport: boolean;
  exportOptions?: TransactionsMobileExport;
  onSelect: () => void;
}) {
  const navigate = useNavigate();
  const exportUnavailable = !exportOptions || exportOptions.disabled || exportOptions.pending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mais ações"
        render={<Button size="icon" type="button" variant="outline" />}
      >
        {exportOptions?.pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Ellipsis aria-hidden="true" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onSelect}>
            <ListChecks aria-hidden="true" />
            Selecionar lançamentos
          </DropdownMenuItem>
          {allowImport ? (
            <DropdownMenuItem onClick={() => void navigate({ to: "/transactions/import" })}>
              <FileUp aria-hidden="true" />
              Importar extrato
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        {exportOptions ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={exportUnavailable}
                onClick={() => exportOptions.onExport("csv")}
              >
                <FileText aria-hidden="true" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={exportUnavailable}
                onClick={() => exportOptions.onExport("xlsx")}
              >
                <FileSpreadsheet aria-hidden="true" />
                Exportar Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
