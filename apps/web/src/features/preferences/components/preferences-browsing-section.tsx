import type { MobileShortcutDestination } from "@openmonetis/domain/preferences";
import {
  mobileShortcutDestinations,
  notificationDueSoonDayOptions,
  transactionPageSizeOptions,
} from "@openmonetis/domain/preferences";
import type { UserPreferencesOutput } from "@openmonetis/validators/preferences";
import { ListFilter } from "lucide-react";
import { useId } from "react";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsRow } from "@/components/settings-row";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/useIsMobile";
import { mobileShortcutLabels } from "../preferences.presentation";
import type { PreferencesFormApi } from "../usePreferencesForm";

export function PreferencesBrowsingSection({
  form,
  disabled: isMutating,
}: {
  form: PreferencesFormApi;
  disabled: boolean;
}) {
  const dueSoonDaysId = useId();
  const pageSizeId = useId();
  const mobileShortcutId = useId();
  const mobile = useIsMobile();
  return (
    <SettingsSection
      description="Ajuste como você acompanha vencimentos e navega pelos seus dados."
      icon={ListFilter}
      title="Vencimentos e listagem"
    >
      <div className="divide-y divide-border">
        <form.Field name="notificationDueSoonDays">
          {(field) => (
            <SettingsRow
              description="Quando boletos e faturas passam a aparecer como próximos do vencimento."
              id={dueSoonDaysId}
              label="Sinalizar vencimentos"
            >
              <Select
                disabled={isMutating}
                onValueChange={(value) =>
                  value &&
                  field.handleChange(
                    Number(value) as UserPreferencesOutput["notificationDueSoonDays"],
                  )
                }
                value={String(field.state.value)}
              >
                <SelectTrigger
                  className="w-full"
                  id={dueSoonDaysId}
                  aria-describedby={`${dueSoonDaysId}-description`}
                >
                  <SelectValue>
                    {field.state.value} {field.state.value === 1 ? "dia antes" : "dias antes"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {notificationDueSoonDayOptions.map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} {days === 1 ? "dia antes" : "dias antes"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          )}
        </form.Field>

        <form.Field name="transactionsPageSize">
          {(field) => (
            <SettingsRow
              description="Quantidade inicial de lançamentos carregados em cada página."
              id={pageSizeId}
              label="Itens por página"
            >
              <Select
                disabled={isMutating}
                onValueChange={(value) =>
                  value &&
                  field.handleChange(Number(value) as UserPreferencesOutput["transactionsPageSize"])
                }
                value={String(field.state.value)}
              >
                <SelectTrigger
                  className="w-full"
                  id={pageSizeId}
                  aria-describedby={`${pageSizeId}-description`}
                >
                  <SelectValue>{field.state.value} lançamentos</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {transactionPageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} lançamentos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          )}
        </form.Field>

        <form.Field name="mobileShortcut">
          {(field) => (
            <SettingsRow
              description={
                mobile
                  ? "Página exibida no botão de atalho. Na barra inferior, pressione e segure para trocar."
                  : "Página exibida no terceiro botão. Na barra inferior, pressione e segure para trocar."
              }
              id={mobileShortcutId}
              label="Atalho da barra inferior"
            >
              <Select
                disabled={isMutating}
                onValueChange={(value) =>
                  value && field.handleChange(value as MobileShortcutDestination)
                }
                value={field.state.value}
              >
                <SelectTrigger
                  aria-describedby={`${mobileShortcutId}-description`}
                  className="w-full"
                  id={mobileShortcutId}
                >
                  <SelectValue>{mobileShortcutLabels[field.state.value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {mobileShortcutDestinations.map((destination) => (
                    <SelectItem key={destination} value={destination}>
                      {mobileShortcutLabels[destination]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          )}
        </form.Field>
      </div>
    </SettingsSection>
  );
}
