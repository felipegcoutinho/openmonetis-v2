import { Link } from "@tanstack/react-router";
import { BookOpen, ExternalLink, Inbox, Workflow } from "lucide-react";
import { SettingsPanel, SettingsSection } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { DeviceTokenSettings } from "@/features/device-tokens/components/device-token-settings";

function inboxSearch(search: { status?: "pending"; rules?: "open" }) {
  return {
    status: undefined,
    page: undefined,
    app: undefined,
    date: undefined,
    rule: undefined,
    rules: undefined,
    ...search,
  };
}

export function IntegrationsSettings() {
  return (
    <SettingsPanel>
      <DeviceTokenSettings />
      <SettingsSection
        contentClassName="grid gap-5"
        icon={BookOpen}
        title="Como conectar"
        description="Receba notificações financeiras do Android e revise antes de criar lançamentos."
      >
        <ol className="grid list-decimal gap-3 pl-5 text-sm leading-relaxed marker:text-muted-foreground">
          <li className="pl-1">
            <span className="font-medium">Instale o Companion</span>{" "}
            <span className="text-muted-foreground">
              no Android que recebe as notificações do banco.
            </span>
          </li>
          <li className="pl-1">
            <span className="font-medium">Configure o endereço HTTPS da API</span>{" "}
            <span className="text-muted-foreground">
              no Companion. Ele pode ser diferente do endereço deste site; em caso de dúvida,
              consulte quem administra a instalação.
            </span>
          </li>
          <li className="pl-1">
            <span className="font-medium">Clique em Conectar aparelho</span>{" "}
            <span className="text-muted-foreground">
              e escaneie o QR Code ou copie o token. A conexão é confirmada nesta tela.
            </span>
          </li>
          <li className="pl-1">
            <span className="font-medium">Revise as capturas na Caixa de entrada</span>{" "}
            <span className="text-muted-foreground">
              e crie regras para preencher categorias e pessoas automaticamente.
            </span>
          </li>
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline">
            <a
              href="https://github.com/felipegcoutinho/openmonetis-companion"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" />
              Instalação e ajuda
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link to="/inbox" search={inboxSearch({ status: "pending" })}>
              <Inbox aria-hidden="true" />
              Abrir Caixa de entrada
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/inbox" search={inboxSearch({ rules: "open" })}>
              <Workflow aria-hidden="true" />
              Regras da Caixa de entrada
            </Link>
          </Button>
        </div>
      </SettingsSection>
    </SettingsPanel>
  );
}
