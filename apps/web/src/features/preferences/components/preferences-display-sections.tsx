import { ShieldCheck } from "lucide-react";
import { useId } from "react";
import { SettingsSection } from "@/components/settings-panel";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PreferencesFormApi } from "../usePreferencesForm";
import { PreferencesAppearanceSection } from "./preferences-appearance-section";

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
      <PreferencesAppearanceSection disabled={isMutating} />

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
                    className="cursor-pointer normal-case font-mono text-sm tracking-normal"
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
