import { invoicePaymentCategoryName } from "@openmonetis/domain/categories";
import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
} from "@openmonetis/shared/date-time";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";
import {
  ImportTransactionsInputSchema,
  type TransactionImportPreview,
} from "@openmonetis/validators/transactions";
import { useForm } from "@tanstack/react-form";
import { Image } from "@unpic/react";
import { Download, FileSpreadsheet, ReceiptText, RotateCcw, Upload } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";
import {
  getTransactionMutationErrorMessage,
  paymentMethodLabels,
} from "../transactions.presentation";
import { InvoicePeriodPicker } from "./invoice-period-picker";
import { TransactionTypeBadge } from "./transaction-type-badge";

type PreviewRow = TransactionImportPreview["transactions"][number];
type ReviewRow = PreviewRow & {
  rowKey: string;
  selected: boolean;
  personId: string;
  categoryId: string;
};

type Props = {
  accounts: AccountOutput[];
  cards: CardOutput[];
  categories: CategoryOutput[];
  people: PersonOutput[];
  isLoadingOptions: boolean;
  isDownloadingTemplate: boolean;
  isPreviewing: boolean;
  isImporting: boolean;
  onPreview: (file: File) => Promise<TransactionImportPreview>;
  onDownloadTemplate: () => Promise<{ fileName: string; contentBase64: string }>;
  onImport: (
    input: import("@openmonetis/validators/transactions").ImportTransactionsInput,
  ) => Promise<void>;
};

const acceptedExtensions = ["ofx", "qfx", "xlsx"];
const accountPaymentMethods = [
  "pix",
  "debit_card",
  "cash",
  "boleto",
  "benefits",
  "bank_transfer",
] as const;

export function TransactionImportScreen({
  accounts,
  cards,
  categories,
  people,
  isLoadingOptions,
  isDownloadingTemplate,
  isPreviewing,
  isImporting,
  onPreview,
  onDownloadTemplate,
  onImport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<TransactionImportPreview | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const selectableCategories = categories.filter(
    (category) => category.name !== invoicePaymentCategoryName,
  );
  const form = useForm({
    defaultValues: {
      destination: "",
      paymentMethod: "pix" as (typeof accountPaymentMethods)[number] | "credit_card",
      invoicePeriod: currentPeriod(),
    },
    onSubmit: async ({ value }) => {
      if (!preview) {
        setError("Selecione um arquivo para importar.");
        return;
      }
      const [destinationType, destinationId] = value.destination.split(":") as [
        "account" | "card",
        string,
      ];
      const parsed = ImportTransactionsInputSchema.safeParse({
        sourceFingerprint: preview.sourceFingerprint,
        destinationType,
        destinationId,
        paymentMethod: value.paymentMethod,
        invoicePeriod: destinationType === "card" ? value.invoicePeriod : null,
        rows: rows
          .filter((row) => row.selected)
          .map((row) => ({
            externalId: row.externalId,
            purchaseDate: row.purchaseDate,
            amount: row.amount,
            name: row.name,
            type: row.type,
            personId: row.personId,
            categoryId: row.categoryId,
          })),
      });
      if (!parsed.success) {
        setError("Preencha a conta, a pessoa e a categoria dos lançamentos selecionados.");
        return;
      }
      setError(null);
      try {
        await onImport(parsed.data);
      } catch (error) {
        setError(getTransactionMutationErrorMessage(error));
      }
    },
  });

  const selectedRows = rows.filter((row) => row.selected);
  const incompleteRows = selectedRows.filter((row) => !row.personId || !row.categoryId);
  const duplicateCount = rows.filter((row) => row.isDuplicate).length;
  const allAvailableSelected = rows.filter((row) => !row.isDuplicate).every((row) => row.selected);
  const selectedExpenseRows = selectedRows.filter((row) => row.type === "expense");
  const selectedIncomeRows = selectedRows.filter((row) => row.type === "income");
  const commonPersonId = getCommonRowValue(selectedRows, (row) => row.personId);
  const commonExpenseCategoryId = getCommonRowValue(selectedExpenseRows, (row) => row.categoryId);
  const commonIncomeCategoryId = getCommonRowValue(selectedIncomeRows, (row) => row.categoryId);
  const selectedPeopleDiffer = haveDifferentRowValues(selectedRows, (row) => row.personId);
  const selectedExpenseCategoriesDiffer = haveDifferentRowValues(
    selectedExpenseRows,
    (row) => row.categoryId,
  );
  const selectedIncomeCategoriesDiffer = haveDifferentRowValues(
    selectedIncomeRows,
    (row) => row.categoryId,
  );

  async function handleFile(file: File) {
    setError(null);
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    if (!acceptedExtensions.includes(extension)) {
      setError("Formato não suportado. Use OFX, QFX ou XLSX.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("O arquivo deve ter no máximo 5 MB.");
      return;
    }
    try {
      const result = await onPreview(file);
      const defaultPersonId =
        people.find((person) => person.role === "admin")?.id ?? people[0]?.id ?? "";
      const destination = result.isCreditCard
        ? cards[0]
          ? `card:${cards[0].id}`
          : ""
        : accounts[0]
          ? `account:${accounts[0].id}`
          : "";
      form.reset({
        destination,
        paymentMethod: result.isCreditCard ? "credit_card" : "pix",
        invoicePeriod: result.period?.to.slice(0, 7) ?? currentPeriod(),
      });
      setRows(
        result.transactions.map((transaction) => ({
          ...transaction,
          rowKey: crypto.randomUUID(),
          selected: !transaction.isDuplicate,
          personId: defaultPersonId,
          categoryId: findCategoryByImportedName(categories, transaction),
        })),
      );
      setPreview(result);
    } catch {
      setError("Não foi possível ler o arquivo. Verifique o formato e tente novamente.");
    }
  }

  function updateSelectedRows(update: (row: ReviewRow) => ReviewRow) {
    setRows((current) => current.map((row) => (row.selected ? update(row) : row)));
  }

  function resetUpload() {
    setPreview(null);
    setRows([]);
    setError(null);
    form.reset();
  }

  async function downloadTemplate() {
    setError(null);
    try {
      const template = await onDownloadTemplate();
      const bytes = Uint8Array.from(atob(template.contentBase64), (character) =>
        character.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = template.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Não foi possível baixar o modelo.");
    }
  }

  return (
    <section className="app-page project-container">
      <PageHeader
        breadcrumbs={[
          { label: "Visão geral", href: "/dashboard" },
          { label: "Lançamentos", href: "/transactions" },
          { label: "Importar extrato" },
        ]}
        description="Revise os lançamentos do arquivo antes de adicioná-los à sua conta."
        icon={<ReceiptText aria-hidden="true" className="size-5" />}
        title="Importar extrato"
      />

      {!preview ? (
        <Card className="border" aria-labelledby="upload-title">
          <CardHeader className="border-b">
            <CardTitle id="upload-title">Selecione o extrato</CardTitle>
            <CardDescription>Envie um arquivo OFX, QFX ou XLSX de até 5 MB.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className={cn(
                "grid min-h-72 w-full place-items-center border border-dashed px-8 py-12 text-center whitespace-normal shadow-none",
                dragging && "border-brand-strong bg-brand/5 text-foreground",
              )}
              disabled={isPreviewing || isLoadingOptions}
              onClick={() => inputRef.current?.click()}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
              type="button"
              variant="outline"
            >
              <span className="grid justify-items-center gap-4">
                <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
                  {isPreviewing ? (
                    <FileSpreadsheet
                      aria-hidden="true"
                      className="size-7 animate-pulse text-brand-strong"
                    />
                  ) : (
                    <Upload aria-hidden="true" className="size-7" />
                  )}
                </span>
                <span className="grid gap-1.5">
                  <span className="font-medium text-base">
                    {isPreviewing
                      ? "Lendo extrato..."
                      : "Arraste o arquivo aqui ou clique para selecionar"}
                  </span>
                  <span className="font-normal text-muted-foreground text-sm">
                    Formatos aceitos: .ofx, .qfx e .xlsx
                  </span>
                </span>
              </span>
            </Button>
            <input
              accept=".ofx,.qfx,.xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
              ref={inputRef}
              type="file"
            />
          </CardContent>
          <CardFooter className="flex-col items-start justify-between gap-3 border-t sm:flex-row sm:items-center">
            <p className="text-muted-foreground text-xs">
              Não tem um arquivo compatível? Use o modelo para organizar seus lançamentos.
            </p>
            <Button
              disabled={isDownloadingTemplate}
              onClick={() => void downloadTemplate()}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Download />
              {isDownloadingTemplate ? "Preparando modelo..." : "Baixar modelo XLSX"}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <form
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Card className="border" size="sm">
            <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <FileSpreadsheet aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{preview.sourceName}</p>
                    {preview.isCreditCard ? (
                      <Badge variant="outline">Cartão de crédito</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {[
                      preview.accountNumber,
                      preview.period
                        ? `${formatDate(preview.period.from)} a ${formatDate(preview.period.to)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Extrato pronto para revisão"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {selectedRows.length} de {rows.length} selecionados
                </Badge>
                {duplicateCount ? (
                  <Badge variant="outline">{duplicateCount} já importados</Badge>
                ) : null}
                {incompleteRows.length ? (
                  <Badge variant="destructive">{incompleteRows.length} pendentes</Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <form.Subscribe selector={(state) => state.values}>
            {(values) => {
              const isCard = values.destination.startsWith("card:");
              const selectedAccount = values.destination.startsWith("account:")
                ? accounts.find((account) => `account:${account.id}` === values.destination)
                : undefined;
              const selectedCard = values.destination.startsWith("card:")
                ? cards.find((card) => `card:${card.id}` === values.destination)
                : undefined;
              const commonPerson = people.find((person) => person.id === commonPersonId);
              return (
                <Card className="border" aria-labelledby="import-settings-title">
                  <CardHeader className="border-b">
                    <CardTitle id="import-settings-title">Aplicar aos selecionados</CardTitle>
                    <CardDescription>
                      Defina os dados em lote. Depois, ajuste exceções diretamente na lista.
                    </CardDescription>
                    <CardAction>
                      <Badge variant="secondary">{selectedRows.length} selecionados</Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="grid gap-6">
                    <section className="grid gap-3" aria-labelledby="destination-settings-title">
                      <div>
                        <h3 className="font-medium text-sm" id="destination-settings-title">
                          Destino e pagamento
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          Estes dados serão usados em todos os lançamentos importados.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <form.Field name="destination">
                          {(field) => (
                            <Field label="Conta ou cartão">
                              <Select
                                onValueChange={(value) => {
                                  const next = value as string;
                                  field.handleChange(next);
                                  form.setFieldValue(
                                    "paymentMethod",
                                    next.startsWith("card:") ? "credit_card" : "pix",
                                  );
                                }}
                                value={field.state.value}
                              >
                                <SelectTrigger className="h-auto min-h-14 w-full px-3 py-2">
                                  <SelectValue placeholder="Selecione uma conta ou cartão">
                                    {selectedAccount ? (
                                      <EntityOption entity={selectedAccount} kind="Conta" />
                                    ) : selectedCard ? (
                                      <EntityOption entity={selectedCard} kind="Cartão" />
                                    ) : (
                                      <span>Selecione uma conta ou cartão</span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.length ? (
                                    <SelectGroup>
                                      <SelectLabel>Contas</SelectLabel>
                                      {accounts.map((account) => (
                                        <SelectItem
                                          key={account.id}
                                          value={`account:${account.id}`}
                                        >
                                          <EntityOption entity={account} kind="Conta" />
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ) : null}
                                  {accounts.length && cards.length ? <SelectSeparator /> : null}
                                  {cards.length ? (
                                    <SelectGroup>
                                      <SelectLabel>Cartões</SelectLabel>
                                      {cards.map((card) => (
                                        <SelectItem key={card.id} value={`card:${card.id}`}>
                                          <EntityOption entity={card} kind="Cartão" />
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ) : null}
                                </SelectContent>
                              </Select>
                            </Field>
                          )}
                        </form.Field>
                        {!isCard ? (
                          <form.Field name="paymentMethod">
                            {(field) => (
                              <Field label="Forma de pagamento">
                                <Select
                                  onValueChange={(value) =>
                                    field.handleChange(value as typeof field.state.value)
                                  }
                                  value={field.state.value}
                                >
                                  <SelectTrigger className="h-auto min-h-14 w-full px-3 py-2">
                                    <SelectValue>
                                      <TextOption
                                        description="Aplicada aos lançamentos desta importação"
                                        label={paymentMethodLabels[field.state.value]}
                                      />
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {accountPaymentMethods.map((method) => (
                                      <SelectItem key={method} value={method}>
                                        <TextOption label={paymentMethodLabels[method]} />
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                            )}
                          </form.Field>
                        ) : (
                          <form.Field name="invoicePeriod">
                            {(field) => (
                              <Field label="Fatura">
                                <div className="flex min-h-14 items-center rounded-md border border-input bg-popover px-3 shadow-xs">
                                  <InvoicePeriodPicker
                                    onChange={field.handleChange}
                                    value={field.state.value}
                                  />
                                </div>
                              </Field>
                            )}
                          </form.Field>
                        )}
                      </div>
                    </section>

                    <section
                      className="grid gap-3 border-t pt-6"
                      aria-labelledby="bulk-settings-title"
                    >
                      <div>
                        <h3 className="font-medium text-sm" id="bulk-settings-title">
                          Classificação em lote
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          Só os lançamentos marcados recebem as alterações abaixo.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <Field label="Pessoa">
                          <Select
                            disabled={!selectedRows.length}
                            onValueChange={(value) =>
                              updateSelectedRows((row) => ({
                                ...row,
                                personId: value as string,
                              }))
                            }
                            value={commonPersonId || null}
                          >
                            <SelectTrigger className="h-auto min-h-14 w-full px-3 py-2">
                              <SelectValue
                                placeholder={
                                  !selectedRows.length
                                    ? "Nenhum lançamento selecionado"
                                    : selectedPeopleDiffer
                                      ? "Pessoas diferentes"
                                      : "Selecione uma pessoa"
                                }
                              >
                                <PersonOption
                                  description={`${selectedRows.length} lançamento${selectedRows.length === 1 ? "" : "s"} selecionado${selectedRows.length === 1 ? "" : "s"}`}
                                  person={commonPerson}
                                />
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {people.map((person) => (
                                <SelectItem key={person.id} value={person.id}>
                                  <PersonOption person={person} />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <BulkCategorySelect
                          categories={selectableCategories.filter(
                            (category) => category.type === "expense",
                          )}
                          label="Categoria das despesas"
                          mixed={selectedExpenseCategoriesDiffer}
                          onChange={(categoryId) =>
                            updateSelectedRows((row) =>
                              row.type === "expense" ? { ...row, categoryId } : row,
                            )
                          }
                          rowCount={selectedExpenseRows.length}
                          value={commonExpenseCategoryId}
                        />
                        <BulkCategorySelect
                          categories={selectableCategories.filter(
                            (category) => category.type === "income",
                          )}
                          label="Categoria das receitas"
                          mixed={selectedIncomeCategoriesDiffer}
                          onChange={(categoryId) =>
                            updateSelectedRows((row) =>
                              row.type === "income" ? { ...row, categoryId } : row,
                            )
                          }
                          rowCount={selectedIncomeRows.length}
                          value={commonIncomeCategoryId}
                        />
                      </div>
                    </section>
                  </CardContent>
                </Card>
              );
            }}
          </form.Subscribe>

          <Card className="gap-0 border py-0" size="sm">
            <CardHeader className="border-b py-4">
              <CardTitle>Lançamentos do arquivo</CardTitle>
              <CardDescription>Selecione e revise os dados antes de importar.</CardDescription>
              <CardAction>
                <Badge variant="outline">{rows.length} lançamentos</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="max-h-128 overflow-auto px-0">
              <Table className="min-w-230">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Selecionar todos"
                        checked={allAvailableSelected}
                        onCheckedChange={(checked) =>
                          setRows((current) =>
                            current.map((row) =>
                              row.isDuplicate ? row : { ...row, selected: checked },
                            ),
                          )
                        }
                      />
                    </TableHead>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-56">Pessoa</TableHead>
                    <TableHead className="w-48">Categoria</TableHead>
                    <TableHead className="w-24">Tipo</TableHead>
                    <TableHead className="w-32 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow className={cn(!row.selected && "opacity-55")} key={row.rowKey}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Selecionar ${row.name}`}
                          checked={row.selected}
                          disabled={row.isDuplicate}
                          onCheckedChange={(checked) =>
                            setRows((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, selected: checked } : item,
                              ),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(row.purchaseDate)}
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Descrição do lançamento ${index + 1}`}
                          className="h-8 min-w-48 border-transparent bg-transparent shadow-none focus-visible:border-input"
                          disabled={!row.selected}
                          onChange={(event) =>
                            updateRow(setRows, index, { name: event.target.value })
                          }
                          value={row.name}
                        />
                        {row.isDuplicate ? (
                          <Badge className="mt-1" variant="outline">
                            Já importado
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <RowSelect
                          disabled={!row.selected}
                          onChange={(personId) => updateRow(setRows, index, { personId })}
                          people={people}
                          value={row.personId}
                        />
                      </TableCell>
                      <TableCell>
                        <RowCategorySelect
                          categories={selectableCategories.filter(
                            (category) => category.type === row.type,
                          )}
                          disabled={!row.selected}
                          onChange={(categoryId) => updateRow(setRows, index, { categoryId })}
                          value={row.categoryId}
                        />
                      </TableCell>
                      <TableCell>
                        <TransactionTypeBadge type={row.type} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          row.type === "income" && "text-success",
                        )}
                      >
                        {formatCurrency(row.type === "expense" ? -row.amount : row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button disabled={isImporting} onClick={resetUpload} type="button" variant="outline">
              <RotateCcw />
              Escolher outro arquivo
            </Button>
            <Button
              disabled={isImporting || !selectedRows.length || incompleteRows.length > 0}
              type="submit"
            >
              {isImporting ? "Importando..." : `Importar ${selectedRows.length} lançamentos`}
            </Button>
          </div>
        </form>
      )}
      {isLoadingOptions ? <Skeleton className="h-9 w-full" /> : null}
      {!preview && error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-1.5 border-0 p-0">
      <legend className="mb-1.5 font-mono font-medium text-xs">{label}</legend>
      {children}
    </fieldset>
  );
}

function BulkCategorySelect({
  categories,
  label,
  mixed,
  onChange,
  rowCount,
  value,
}: {
  categories: CategoryOutput[];
  label: string;
  mixed: boolean;
  onChange: (id: string) => void;
  rowCount: number;
  value: string;
}) {
  const selectedCategory = categories.find((category) => category.id === value);
  return (
    <Field label={label}>
      <Select
        disabled={!rowCount}
        onValueChange={(next) => onChange(next as string)}
        value={value || null}
      >
        <SelectTrigger className="h-auto min-h-14 w-full px-3 py-2">
          <SelectValue
            placeholder={
              !rowCount
                ? "Nenhum lançamento selecionado"
                : mixed
                  ? "Categorias diferentes"
                  : "Selecione uma categoria"
            }
          >
            <CategoryOption
              category={selectedCategory}
              description={`${rowCount} lançamento${rowCount === 1 ? "" : "s"}`}
            />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <CategoryOption category={category} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function RowCategorySelect({
  categories,
  disabled,
  onChange,
  value,
}: {
  categories: CategoryOutput[];
  disabled: boolean;
  onChange: (id: string) => void;
  value: string;
}) {
  return (
    <Select disabled={disabled} onValueChange={(next) => onChange(next as string)} value={value}>
      <SelectTrigger className="h-8 w-full">
        <SelectValue placeholder="Categoria">
          <CategoryOption category={categories.find((category) => category.id === value)} compact />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <CategoryOption category={category} compact />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RowSelect({
  disabled,
  onChange,
  people,
  value,
}: {
  disabled: boolean;
  onChange: (id: string) => void;
  people: PersonOutput[];
  value: string;
}) {
  const selectedPerson = people.find((person) => person.id === value);
  return (
    <Select disabled={disabled} onValueChange={(next) => onChange(next as string)} value={value}>
      <SelectTrigger className="h-8 w-full">
        <SelectValue placeholder="Pessoa">
          <PersonOption compact person={selectedPerson} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {people.map((person) => (
          <SelectItem key={person.id} value={person.id}>
            <PersonOption compact person={person} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EntityOption({
  entity,
  kind,
}: {
  entity: Pick<AccountOutput, "name" | "logo"> | Pick<CardOutput, "name" | "logo">;
  kind: "Conta" | "Cartão";
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {entity.logo ? (
        <Image
          alt=""
          className="size-8 shrink-0 rounded-full object-contain"
          height={32}
          layout="fixed"
          src={entity.logo}
          width={32}
        />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-medium text-[10px] text-muted-foreground">
          {entity.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
        </span>
      )}
      <span className="grid min-w-0 text-left">
        <span className="truncate font-medium text-sm">{entity.name}</span>
        <span className="text-muted-foreground text-xs">{kind}</span>
      </span>
    </span>
  );
}

function PersonOption({
  compact = false,
  description,
  person,
}: {
  compact?: boolean;
  description?: string;
  person?: PersonOutput;
}) {
  if (!person) return <span>Pessoas diferentes</span>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm" className={cn(!compact && "size-8")}>
        <AvatarImage alt="" src={person.avatarUrl ?? undefined} />
        <AvatarFallback>{person.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 text-left">
        <span className="truncate font-medium text-sm">{person.name}</span>
        {!compact ? (
          <span className="truncate text-muted-foreground text-xs">
            {description ??
              (person.role === "admin" ? "Administradora" : (person.email ?? "Pessoa"))}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function CategoryOption({
  category,
  compact = false,
  description,
}: {
  category?: CategoryOutput;
  compact?: boolean;
  description?: string;
}) {
  if (!category) return <span>Categorias diferentes</span>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground",
          compact ? "size-6" : "size-8",
        )}
      >
        <CategoryIcon className={compact ? "size-3.5" : "size-4"} name={category.icon} />
      </span>
      <span className="grid min-w-0 text-left">
        <span className="truncate font-medium text-sm">{category.name}</span>
        {!compact && description ? (
          <span className="text-muted-foreground text-xs">{description}</span>
        ) : null}
      </span>
    </span>
  );
}

function TextOption({ description, label }: { description?: string; label: string }) {
  return (
    <span className="grid min-w-0 text-left">
      <span className="truncate font-medium text-sm">{label}</span>
      {description ? <span className="text-muted-foreground text-xs">{description}</span> : null}
    </span>
  );
}

function getCommonRowValue(rows: ReviewRow[], selectValue: (row: ReviewRow) => string) {
  const firstValue = rows[0] ? selectValue(rows[0]) : "";
  return firstValue && rows.every((row) => selectValue(row) === firstValue) ? firstValue : "";
}

function haveDifferentRowValues(rows: ReviewRow[], selectValue: (row: ReviewRow) => string) {
  return new Set(rows.map(selectValue)).size > 1;
}

function updateRow(
  setRows: Dispatch<SetStateAction<ReviewRow[]>>,
  index: number,
  update: Partial<ReviewRow>,
) {
  setRows((current) =>
    current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...update } : row)),
  );
}

function findCategoryByImportedName(categories: CategoryOutput[], transaction: PreviewRow) {
  if (transaction.suggestedCategoryId) return transaction.suggestedCategoryId;
  if (!transaction.categoryName) return "";
  const normalized = normalizeText(transaction.categoryName);
  return (
    categories.find(
      (category) =>
        category.type === transaction.type && normalizeText(category.name) === normalized,
    )?.id ?? ""
  );
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function currentPeriod() {
  return getCurrentPeriodInBrazil();
}

const formatDate = (value: string) => formatDateInBrazil(dateOnlyToSafeInstant(value), {});
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
