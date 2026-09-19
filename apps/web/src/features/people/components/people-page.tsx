import type {
  CreatePersonInput,
  PersonOutput,
  ReplacePersonInput,
} from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreatePersonMutation,
  useDeletePersonMutation,
  useReplacePersonMutation,
} from "../people.mutations";
import { peopleQueryOptions } from "../people.queries";
import { PeopleGrid } from "./people-grid";
import { PersonDialog } from "./person-dialog";

export function PeoplePage() {
  const query = useQuery(peopleQueryOptions());
  const create = useCreatePersonMutation();
  const replace = useReplacePersonMutation();
  const remove = useDeletePersonMutation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PersonOutput | null>(null);
  const [removing, setRemoving] = useState<PersonOutput | null>(null);
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setEditing(null);
  }
  async function save(input: CreatePersonInput | ReplacePersonInput) {
    if (editing) await replace.mutateAsync({ id: editing.id, input: input as ReplacePersonInput });
    else await create.mutateAsync(input as CreatePersonInput);
    changeOpen(false);
  }
  async function deleteOne() {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.id);
      setRemoving(null);
      toast.success("Pessoa removida");
    } catch {
      toast.error("Não foi possível remover.");
    }
  }
  const people = query.data ?? [];
  const activePeople = people.filter((person) => person.status === "active");
  const inactivePeople = people.filter((person) => person.status === "inactive");
  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                Nova pessoa
              </Button>
            }
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Organização" }]}
            description="Cadastre pessoas para organizar e dividir valores. Isso não cria um acesso nem ativa compartilhamento. Gerencie quem participa dos seus lançamentos e divisões de despesas."
            eyebrow="Organização"
            icon={<Users aria-hidden="true" className="size-5" />}
            title="Pessoas"
          />
          {query.isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando pessoas...</p>
          ) : null}
          {query.isError ? (
            <p className="text-destructive text-sm">Não foi possível carregar.</p>
          ) : null}
          {query.data ? (
            <Tabs className="gap-0" defaultValue="active">
              <TabsList variant="line">
                <TabsTrigger value="active">Ativas ({activePeople.length})</TabsTrigger>
                <TabsTrigger value="inactive">Inativas ({inactivePeople.length})</TabsTrigger>
              </TabsList>
              <TabsContent className="pt-5" value="active">
                <PeopleStatusGrid
                  emptyMessage="Nenhuma pessoa ativa cadastrada."
                  onEdit={(person) => {
                    setEditing(person);
                    setOpen(true);
                  }}
                  onRemove={setRemoving}
                  people={activePeople}
                />
              </TabsContent>
              <TabsContent className="pt-5" value="inactive">
                <PeopleStatusGrid
                  emptyMessage="Nenhuma pessoa inativa cadastrada."
                  onEdit={(person) => {
                    setEditing(person);
                    setOpen(true);
                  }}
                  onRemove={setRemoving}
                  people={inactivePeople}
                />
              </TabsContent>
            </Tabs>
          ) : null}
        </section>
      </main>
      <PersonDialog person={editing} onOpenChange={changeOpen} onSubmit={save} open={open} />
      <AlertDialog
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
        open={Boolean(removing)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pessoa?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa &quot;{removing?.name}&quot; será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteOne()} variant="destructive">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}

function PeopleStatusGrid({
  emptyMessage,
  onEdit,
  onRemove,
  people,
}: {
  emptyMessage: string;
  onEdit: (person: PersonOutput) => void;
  onRemove: (person: PersonOutput) => void;
  people: PersonOutput[];
}) {
  if (people.length > 0) {
    return <PeopleGrid onEdit={onEdit} onRemove={onRemove} people={people} />;
  }

  return (
    <Card className="grid min-h-52 place-items-center p-6 text-center">
      <p className="text-muted-foreground text-sm">{emptyMessage}</p>
    </Card>
  );
}
