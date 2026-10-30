import { formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { ReplacePersonInput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { KeyRound, Pencil, ReceiptText, UserRound } from "lucide-react";
import { useState } from "react";
import { SettingsPanel, SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import { SettingsRow } from "@/components/settings-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonDialog } from "@/features/people/components/person-dialog";
import { useReplacePersonMutation } from "@/features/people/people.mutations";
import { personQueryOptions } from "@/features/people/people.queries";
import { authClient } from "@/lib/auth-client";
import { passkeysQueryOptions, settingsSecurityQueryOptions } from "../settings.queries";

export function ProfileSettings() {
  const personQuery = useQuery(personQueryOptions("admin"));
  const replacePerson = useReplacePersonMutation();
  const [editing, setEditing] = useState(false);

  if (personQuery.isPending) {
    return (
      <div aria-label="Carregando perfil" className="grid gap-4" role="status">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!personQuery.data) {
    return (
      <SettingsQueryError
        message="Não foi possível carregar seu perfil."
        isRetrying={personQuery.isFetching}
        onRetry={() => void personQuery.refetch()}
      />
    );
  }

  const person = personQuery.data;

  async function updateProfile(input: ReplacePersonInput) {
    await replacePerson.mutateAsync({ id: person.id, input });
    setEditing(false);
  }

  return (
    <>
      <SettingsPanel>
        <SettingsSection
          contentClassName="grid gap-5"
          description="Seus dados como pessoa principal. Eles também identificam seu acesso."
          icon={UserRound}
          title="Perfil"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {person.avatarUrl ? (
                <Image
                  alt={`Avatar de ${person.name}`}
                  className="size-16 shrink-0 rounded-full object-cover"
                  height={64}
                  layout="fixed"
                  src={person.avatarUrl}
                  width={64}
                />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-full bg-muted font-medium text-lg text-muted-foreground">
                  {person.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-heading font-medium text-lg">{person.name}</p>
                <p className="truncate text-muted-foreground text-sm">{person.email}</p>
              </div>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => setEditing(true)}
              type="button"
              variant="outline"
            >
              <Pencil aria-hidden="true" />
              Editar perfil
            </Button>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            O e-mail exibido é o mesmo usado para entrar. Ao alterá-lo, use o novo endereço no
            próximo acesso.
          </p>
        </SettingsSection>

        <ProfileAccessSection />

        <SettingsSection
          contentClassName="grid justify-items-start gap-3"
          description="Você também aparece em Pessoas, onde estão seus lançamentos e o resumo do mês."
          icon={ReceiptText}
          title="Pessoa principal"
        >
          <Button asChild variant="outline">
            <Link params={{ personId: person.id }} to="/people/$personId">
              Ver meus lançamentos
            </Link>
          </Button>
        </SettingsSection>
      </SettingsPanel>

      <PersonDialog
        onOpenChange={setEditing}
        onSubmit={(input) => updateProfile(input as ReplacePersonInput)}
        open={editing}
        person={person}
      />
    </>
  );
}

function ProfileAccessSection() {
  const session = authClient.useSession();
  const securityQuery = useQuery(settingsSecurityQueryOptions());
  const passkeysQuery = useQuery(passkeysQueryOptions());
  const createdAt = session.data?.user.createdAt;
  const methods = [
    securityQuery.data ? (securityQuery.data.passwordChangeAvailable ? "Senha" : "Google") : null,
    passkeysQuery.data?.length
      ? passkeysQuery.data.length === 1
        ? "1 chave de acesso"
        : `${passkeysQuery.data.length} chaves de acesso`
      : null,
  ].filter(Boolean);
  const loadingMethods = securityQuery.isPending || passkeysQuery.isPending;

  return (
    <SettingsSection
      description="Resumo de como você entra no OpenMonetis."
      icon={KeyRound}
      title="Acesso"
    >
      <div className="divide-y divide-border">
        <SettingsRow
          description="Gerencie senha e chaves de acesso em Segurança."
          id="profile-access-methods"
          label="Formas de entrar"
        >
          <div className="grid justify-items-start gap-2 sm:justify-items-end">
            <p className="font-medium text-sm" id="profile-access-methods">
              {loadingMethods ? "Carregando…" : methods.join(" · ") || "Indisponível"}
            </p>
            <Button asChild size="sm" variant="ghost">
              <Link search={{ tab: "security" }} to="/settings">
                Abrir Segurança
              </Link>
            </Button>
          </div>
        </SettingsRow>
        {createdAt ? (
          <SettingsRow
            description="Data em que seu acesso foi criado."
            id="profile-created-at"
            label="Conta criada em"
          >
            <p className="font-medium text-sm sm:text-right" id="profile-created-at">
              {formatDateInBrazil(new Date(createdAt), { dateStyle: "long" })}
            </p>
          </SettingsRow>
        ) : null}
      </div>
    </SettingsSection>
  );
}
