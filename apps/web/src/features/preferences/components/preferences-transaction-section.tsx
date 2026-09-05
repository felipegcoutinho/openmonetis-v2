import { paymentMethods } from "@openmonetis/domain/transactions";
import type { UserPreferencesOutput } from "@openmonetis/validators/preferences";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { Banknote, Barcode, CreditCard, Landmark, QrCode, ReceiptText, Ticket } from "lucide-react";
import { useId } from "react";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import { SettingsRow } from "@/components/settings-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";
import { automaticPreferenceValue } from "../preferences.presentation";
import type { PreferencesFormApi } from "../usePreferencesForm";

export function PreferencesTransactionSection({
  form,
  disabled: isMutating,
}: {
  form: PreferencesFormApi;
  disabled: boolean;
}) {
  const paymentMethodId = useId();
  const accountId = useId();
  const cardId = useId();
  const accountsQuery = useQuery(accountsQueryOptions());
  const cardsQuery = useQuery(cardsQueryOptions());
  const accounts = (accountsQuery.data ?? []).filter((account) => !account.isArchived);
  const cards = (cardsQuery.data ?? []).filter((card) => card.status === "active");
  return (
    <SettingsSection
      description="Defina o que já vem selecionado ao criar um lançamento."
      icon={ReceiptText}
      title="Padrões de lançamento"
    >
      <div className="divide-y divide-border">
        <form.Field name="defaultPaymentMethod">
          {(field) => (
            <SettingsRow
              description="Você ainda poderá alterar a forma de pagamento em cada lançamento."
              id={paymentMethodId}
              label="Forma de pagamento"
            >
              <Select
                disabled={isMutating}
                onValueChange={(value) =>
                  value &&
                  field.handleChange(value as UserPreferencesOutput["defaultPaymentMethod"])
                }
                value={field.state.value}
              >
                <SelectTrigger
                  className="w-full"
                  id={paymentMethodId}
                  aria-describedby={`${paymentMethodId}-description`}
                >
                  <SelectValue>
                    <PaymentMethodLabel method={field.state.value} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      <PaymentMethodLabel method={method} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          )}
        </form.Field>

        <form.Field name="defaultAccountId">
          {(field) => (
            <SettingsRow
              description="Sem uma preferência, usa a primeira conta ativa da lista."
              id={accountId}
              label="Conta padrão"
            >
              <div className="grid gap-2">
                <Select
                  disabled={isMutating || accountsQuery.isPending || accountsQuery.isError}
                  onValueChange={(value) =>
                    value && field.handleChange(value === automaticPreferenceValue ? null : value)
                  }
                  value={field.state.value ?? automaticPreferenceValue}
                >
                  <SelectTrigger
                    className="w-full"
                    id={accountId}
                    aria-describedby={`${accountId}-description`}
                  >
                    <SelectValue>
                      <PreferenceEntityLabel
                        entity={accounts.find((account) => account.id === field.state.value)}
                        unavailable={Boolean(field.state.value)}
                        loading={accountsQuery.isPending}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={automaticPreferenceValue}>Primeiro da lista</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <PreferenceEntityLabel entity={account} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accountsQuery.isError ? (
                  <SettingsQueryError
                    message="Não foi possível carregar contas."
                    isRetrying={accountsQuery.isFetching}
                    onRetry={() => void accountsQuery.refetch()}
                  />
                ) : null}
                {accountsQuery.isSuccess && accounts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Nenhuma conta ativa disponível. Você pode cadastrar em Finanças.
                  </p>
                ) : null}
              </div>
            </SettingsRow>
          )}
        </form.Field>

        <form.Field name="defaultCardId">
          {(field) => (
            <SettingsRow
              description="No crédito, usa este cartão ou o primeiro cartão ativo da lista."
              id={cardId}
              label="Cartão padrão"
            >
              <div className="grid gap-2">
                <Select
                  disabled={isMutating || cardsQuery.isPending || cardsQuery.isError}
                  onValueChange={(value) =>
                    value && field.handleChange(value === automaticPreferenceValue ? null : value)
                  }
                  value={field.state.value ?? automaticPreferenceValue}
                >
                  <SelectTrigger
                    className="w-full"
                    id={cardId}
                    aria-describedby={`${cardId}-description`}
                  >
                    <SelectValue>
                      <PreferenceEntityLabel
                        entity={cards.find((card) => card.id === field.state.value)}
                        unavailable={Boolean(field.state.value)}
                        loading={cardsQuery.isPending}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={automaticPreferenceValue}>Primeiro da lista</SelectItem>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        <PreferenceEntityLabel entity={card} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cardsQuery.isError ? (
                  <SettingsQueryError
                    message="Não foi possível carregar cartões."
                    isRetrying={cardsQuery.isFetching}
                    onRetry={() => void cardsQuery.refetch()}
                  />
                ) : null}
                {cardsQuery.isSuccess && cards.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Nenhum cartão ativo disponível. Você pode cadastrar em Finanças.
                  </p>
                ) : null}
              </div>
            </SettingsRow>
          )}
        </form.Field>
      </div>
    </SettingsSection>
  );
}
const paymentMethodIcons = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  pix: QrCode,
  cash: Banknote,
  boleto: Barcode,
  benefits: Ticket,
  bank_transfer: Landmark,
} satisfies Record<UserPreferencesOutput["defaultPaymentMethod"], typeof CreditCard>;

function PaymentMethodLabel({ method }: { method: UserPreferencesOutput["defaultPaymentMethod"] }) {
  const Icon = paymentMethodIcons[method];

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{paymentMethodLabels[method]}</span>
    </span>
  );
}

function PreferenceEntityLabel({
  entity,
  unavailable = false,
  loading = false,
}: {
  entity?: { logo: string | null; name: string };
  unavailable?: boolean;
  loading?: boolean;
}) {
  if (loading) return "Carregando…";
  if (!entity) return unavailable ? "Seleção indisponível" : "Primeiro da lista";

  return (
    <span className="flex min-w-0 items-center gap-2">
      {entity.logo ? (
        <Image
          alt=""
          aria-hidden="true"
          className="size-5 shrink-0 rounded-full object-contain"
          height={20}
          layout="fixed"
          src={entity.logo}
          width={20}
        />
      ) : (
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted font-medium text-[8px] text-muted-foreground">
          {entity.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="truncate">{entity.name}</span>
    </span>
  );
}
