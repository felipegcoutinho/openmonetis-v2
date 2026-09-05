import type { UserPreferencesOutput } from "@openmonetis/validators/preferences";
import { useQuery } from "@tanstack/react-query";
import { SettingsPanel } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { userPreferencesQueryOptions } from "../preferences.queries";
import { usePreferencesForm } from "../usePreferencesForm";
import { PreferencesActions } from "./preferences-actions";
import { PreferencesBrowsingSection } from "./preferences-browsing-section";
import { PreferencesDisplaySections } from "./preferences-display-sections";
import { PreferencesTransactionSection } from "./preferences-transaction-section";

export function PreferencesForm() {
  const query = useQuery(userPreferencesQueryOptions());
  if (query.isPending)
    return (
      <div aria-label="Carregando preferências" className="grid gap-4" role="status">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  if (!query.data)
    return (
      <SettingsQueryError
        message="Não foi possível carregar as preferências."
        isRetrying={query.isFetching}
        onRetry={() => void query.refetch()}
      />
    );
  return <PreferencesEditor preferences={query.data} />;
}

function PreferencesEditor({ preferences }: { preferences: UserPreferencesOutput }) {
  const { form, isRestoring, restoreDefaults } = usePreferencesForm(preferences);
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <SettingsPanel>
            <PreferencesDisplaySections form={form} disabled={isSubmitting || isRestoring} />
            <PreferencesTransactionSection form={form} disabled={isSubmitting || isRestoring} />
            <PreferencesBrowsingSection form={form} disabled={isSubmitting || isRestoring} />
          </SettingsPanel>
        )}
      </form.Subscribe>
      <PreferencesActions
        form={form}
        isRestoring={isRestoring}
        onRestoreDefaults={restoreDefaults}
      />
    </form>
  );
}
