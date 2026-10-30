import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  Database,
  Plug,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DueDateRulesPage } from "@/features/due-date-rules/components/due-date-rules-page";
import { PreferencesForm } from "@/features/preferences/components/preferences-form";
import { type SettingsTab, settingsTabs } from "../settings.presentation";
import { AccountDataSettings } from "./account-data-settings";
import { IntegrationsSettings } from "./integrations-settings";
import { ProfileSettings } from "./profile-settings";
import { SecuritySettings } from "./security-settings";

const tabItems = [
  { value: "profile", label: "Perfil", icon: UserRound },
  { value: "preferences", label: "Preferências", icon: SlidersHorizontal },
  { value: "due-date-rules", label: "Regras de vencimento", icon: CalendarClock },
  { value: "security", label: "Segurança", icon: ShieldCheck },
  { value: "integrations", label: "Integrações", icon: Plug },
  { value: "account-data", label: "Dados da conta", icon: Database },
] as const satisfies ReadonlyArray<{ value: SettingsTab; label: string; icon: typeof Settings }>;

export function SettingsPage() {
  const search = useSearch({ from: "/settings" });
  const navigate = useNavigate({ from: "/settings" });
  const activeTab = settingsTabs.includes(search.tab as SettingsTab)
    ? (search.tab as SettingsTab)
    : "profile";

  function changeTab(value: string) {
    const tab = value as SettingsTab;
    void navigate({
      replace: true,
      search: { tab: tab === "profile" ? undefined : tab },
    });
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Ajustes" }]}
            description="Gerencie sua experiência, integrações e os dados vinculados à sua conta."
            eyebrow="Conta"
            icon={<Settings aria-hidden="true" className="size-5" />}
            title="Ajustes"
          />

          <Tabs className="min-w-0 gap-0" onValueChange={changeTab} value={activeTab}>
            <div className="relative">
              <div className="overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
                <TabsList className="min-w-max" variant="line">
                  {tabItems.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value}>
                      <Icon aria-hidden="true" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent sm:hidden"
              />
            </div>

            <TabsContent className="pt-5" value="profile">
              <ProfileSettings />
            </TabsContent>
            <TabsContent className="pt-5" value="preferences">
              <PreferencesForm />
            </TabsContent>
            <TabsContent className="pt-5" value="due-date-rules">
              <DueDateRulesPage />
            </TabsContent>
            <TabsContent className="pt-5" value="security">
              <SecuritySettings />
            </TabsContent>
            <TabsContent className="pt-5" value="integrations">
              <IntegrationsSettings />
            </TabsContent>
            <TabsContent className="pt-5" value="account-data">
              <AccountDataSettings />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </ProtectedRoute>
  );
}
