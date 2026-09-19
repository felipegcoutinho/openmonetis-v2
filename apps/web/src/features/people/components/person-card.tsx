import type { PersonOutput } from "@openmonetis/validators/people";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { MessageSquare, Pencil, Trash2, UserRound } from "lucide-react";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PersonCardProps = {
  person: PersonOutput;
  onEdit: (person: PersonOutput) => void;
  onRemove?: (person: PersonOutput) => void;
};

export function PersonCard({ person, onEdit, onRemove }: PersonCardProps) {
  const isAdmin = person.role === "admin";
  const isInactive = person.status === "inactive";

  return (
    <Card className={cn("gap-5", isInactive && "opacity-70")}>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {person.avatarUrl ? (
              <Image
                alt={`Avatar de ${person.name}`}
                className="size-12 shrink-0 rounded-full object-cover"
                height={48}
                layout="fixed"
                src={person.avatarUrl}
                width={48}
              />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted font-medium text-muted-foreground">
                {person.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <CardTitle className="truncate">
                  <Link
                    to="/people/$personId"
                    params={{ personId: person.id }}
                    className="hover:underline"
                  >
                    {person.name}
                  </Link>
                </CardTitle>
                {isAdmin ? <CurrentUserBadge /> : null}
                {person.note ? (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={`Observação sobre ${person.name}`}
                      render={<button type="button" />}
                    >
                      <MessageSquare aria-hidden="true" className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{person.note}</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <p className="mt-0.5 text-muted-foreground text-xs">{isAdmin ? "Você" : "Pessoa"}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                isInactive ? "bg-muted-foreground" : "bg-emerald-500",
              )}
            />
            {isInactive ? "Inativa" : "Ativa"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs">E-mail</p>
        <p className="truncate text-sm">{person.email ?? "Sem e-mail cadastrado"}</p>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-3 border-t pt-3">
        <Link
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          params={{ personId: person.id }}
          to="/people/$personId"
        >
          <UserRound aria-hidden="true" className="size-3.5" />
          Ver painel
        </Link>
        <button
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onEdit(person)}
          type="button"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editar
        </button>
        {onRemove ? (
          <button
            className="ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-destructive text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => onRemove(person)}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Remover
          </button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
