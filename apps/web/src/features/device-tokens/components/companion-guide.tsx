import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronDown, ExternalLink, Inbox, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const companionHelpUrl = "https://github.com/felipegcoutinho/openmonetis-companion";

const connectionSteps = [
  {
    action: "Instale o Companion",
    detail: "no Android que recebe as notificações do banco.",
  },
  {
    action: "Informe a URL HTTPS da API",
    detail: "no Companion para que ele envie as capturas à sua conta.",
  },
  {
    action: "Clique em Conectar aparelho",
    detail: "e escaneie o QR Code ou copie o token. A conexão é confirmada nesta tela.",
  },
  {
    action: "Revise as capturas na Caixa de entrada",
    detail: "e crie regras para preencher categorias e pessoas automaticamente.",
  },
] as const;

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

export function CompanionGuide({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <div className="grid gap-4">
      <Collapsible className="rounded-lg border border-border" defaultOpen={defaultOpen}>
        <CollapsibleTrigger
          render={
            <Button
              className="group h-11 w-full justify-between rounded-lg px-4 data-panel-open:rounded-b-none"
              type="button"
              variant="ghost"
            />
          }
        >
          <span className="flex items-center gap-2">
            <BookOpen aria-hidden="true" className="text-muted-foreground" />
            Como conectar
          </span>
          <ChevronDown
            aria-hidden="true"
            className="text-muted-foreground transition-transform group-data-panel-open:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="grid list-decimal gap-3 border-border border-t py-4 pr-4 pl-9 text-sm leading-relaxed marker:text-muted-foreground">
            {connectionSteps.map((step) => (
              <li className="pl-1" key={step.action}>
                <span className="font-medium">{step.action}</span>{" "}
                <span className="text-muted-foreground">{step.detail}</span>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild variant="outline">
          <a href={companionHelpUrl} rel="noreferrer" target="_blank">
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
    </div>
  );
}
