import { applicationThemes } from "@openmonetis/domain/preferences";
import type { UserPreferencesOutput } from "@openmonetis/validators/preferences";
import { Check, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { useId } from "react";
import { SettingsSection } from "@/components/settings-panel";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { PreferencesFormApi } from "../usePreferencesForm";

export function PreferencesDisplaySections({
  form,
  disabled: isMutating,
}: {
  form: PreferencesFormApi;
  disabled: boolean;
}) {
  const privacyId = useId();
  return (
    <>
      <SettingsSection
        description="Escolha um tema. A mudança será aplicada ao salvar."
        icon={Sun}
        title="Aparência"
      >
        <form.Field name="theme">
          {(field) => (
            <fieldset className="grid grid-cols-3 gap-2 sm:gap-3" disabled={isMutating}>
              <legend className="sr-only">Tema do aplicativo</legend>
              {applicationThemes.map((theme) => {
                const ThemeIcon = themeIcons[theme];
                const selected = field.state.value === theme;

                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "relative flex min-h-20 flex-col items-start rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-brand-strong/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                      selected && "border-brand-strong/50 bg-brand/10 ring-1 ring-brand-strong/20",
                    )}
                    key={theme}
                    onClick={() => field.handleChange(theme)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-md bg-muted text-muted-foreground transition-colors",
                        selected && "bg-brand/15 text-brand-strong",
                      )}
                    >
                      <ThemeIcon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="mt-2 font-medium text-sm">{themeLabels[theme]}</span>
                    <span className="mt-0.5 hidden text-muted-foreground text-xs sm:block">
                      {themeDescriptions[theme]}
                    </span>
                    {selected ? (
                      <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand text-brand-foreground">
                        <Check aria-hidden="true" className="size-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </fieldset>
          )}
        </form.Field>
      </SettingsSection>

      <SettingsSection
        description="Controle como seus dados aparecem ao abrir o aplicativo."
        icon={ShieldCheck}
        title="Privacidade"
      >
        <form.Field name="hideValuesOnStart">
          {(field) => (
            <div className="flex items-start justify-between gap-6 py-1">
              <div className="flex min-w-0 items-start gap-3">
                <div>
                  <Label
                    className="cursor-pointer normal-case font-sans text-sm tracking-normal"
                    htmlFor={privacyId}
                  >
                    Ocultar valores ao entrar
                  </Label>
                  <p
                    className="mt-1 text-muted-foreground text-sm leading-relaxed"
                    id={`${privacyId}-description`}
                  >
                    Nos próximos acessos, os valores começam ocultos. Use o ícone de olho no
                    cabeçalho para revelá-los.
                  </p>
                </div>
              </div>
              <Switch
                aria-describedby={`${privacyId}-description`}
                checked={field.state.value}
                className="mt-0.5 shrink-0"
                disabled={isMutating}
                id={privacyId}
                onCheckedChange={field.handleChange}
              />
            </div>
          )}
        </form.Field>
      </SettingsSection>
    </>
  );
}
const themeIcons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} satisfies Record<UserPreferencesOutput["theme"], typeof Sun>;

const themeLabels = {
  system: "Sistema",
  light: "Claro",
  dark: "Escuro",
} satisfies Record<UserPreferencesOutput["theme"], string>;

const themeDescriptions = {
  system: "Segue seu dispositivo",
  light: "Tema claro",
  dark: "Tema escuro",
} satisfies Record<UserPreferencesOutput["theme"], string>;
