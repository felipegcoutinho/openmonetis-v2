import { Link } from "@tanstack/react-router";
import { ExternalLink, Smartphone } from "lucide-react";
import { SettingsPanel, SettingsSection } from "@/components/settings-panel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { DeviceTokenSettings } from "@/features/device-tokens/components/device-token-settings";

export function CompanionSettings() {
  return (
    <SettingsPanel>
      <p className="rounded-lg border p-3 text-muted-foreground text-sm">
        Primeiro configure o endereço HTTPS da API no Companion. Depois escaneie o QR Code, que
        contém somente o token de acesso.
      </p>
      <DeviceTokenSettings />
      <SettingsSection
        icon={Smartphone}
        title="Como conectar"
        description="Receba notificações financeiras do Android e revise antes de criar lançamentos."
      >
        <ol className="grid gap-5 sm:grid-cols-2">
          {[
            [
              "1",
              "Instale no Android",
              "Instale o OpenMonetis Companion no aparelho que recebe as notificações do banco.",
            ],
            [
              "2",
              "Configure o endereço",
              "No Companion, informe o endereço HTTPS da API desta instalação.",
            ],
            [
              "3",
              "Conecte o aparelho",
              "Use o botão Conectar aparelho acima. Depois, escaneie o QR Code ou copie o token para o Companion.",
            ],
            [
              "4",
              "Confira o recebimento",
              "Após uma notificação capturada pelo Companion, confira a Caixa de entrada. Você decide o que salvar.",
            ],
          ].map(([step, title, description]) => (
            <li className="flex gap-3" key={step}>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-medium text-xs">
                {step}
              </span>
              <div>
                <h3 className="font-medium text-sm">{title}</h3>
                <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link
              to="/inbox"
              search={{ status: "pending", page: undefined, app: undefined, date: undefined }}
            >
              Abrir Caixa de entrada
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <a
              href="https://github.com/felipegcoutinho/openmonetis-companion"
              rel="noreferrer"
              target="_blank"
            >
              Instalação e ajuda
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </div>
        <Accordion className="mt-4 border-t">
          <AccordionItem value="connection-details">
            <AccordionTrigger>Endereço da API e permissões de acesso</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              <p>
                O endereço da API pode ser diferente do endereço deste site. Se você não administra
                a instalação, solicite o endereço HTTPS a quem a configurou.
              </p>
              <p>
                O QR Code contém somente o token de acesso. Configure o endereço no Companion antes
                de escaneá-lo. Cada aparelho tem uma autorização própria, que pode ser revogada sem
                apagar capturas já recebidas.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SettingsSection>
    </SettingsPanel>
  );
}
