import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Megaphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMarkReleaseSeenMutation } from "../releases.mutations";
import { releaseStateErrorMessage } from "../releases.presentation";
import { releasesQueryOptions } from "../releases.queries";

export function ReleaseNotice({ enabled }: { enabled: boolean }) {
  const releasesQuery = useQuery(releasesQueryOptions(enabled));
  const markSeenMutation = useMarkReleaseSeenMutation();
  const currentRelease = releasesQuery.data?.releases.find((release) => release.isCurrent);
  const currentVersion = currentRelease?.version;

  if (!releasesQuery.data?.hasUnseenCurrentRelease || !currentRelease || !currentVersion)
    return null;

  const dismiss = () => {
    markSeenMutation.mutate(currentVersion, {
      onError: () => toast.error(releaseStateErrorMessage()),
    });
  };

  return (
    <aside className="border-brand/20 border-b bg-brand/10" aria-label="Novidades da versão">
      <div className="project-container flex items-center gap-3 px-[clamp(1rem,3vw,2.5rem)] py-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-brand-strong">
          <Megaphone aria-hidden="true" className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">Novidades da versão {currentRelease.version}</span>
          <span className="hidden text-muted-foreground md:inline">
            {" "}
            · {currentRelease.summary}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild size="sm" variant="outline">
            <Link aria-label="Ver novidades" onClick={dismiss} to="/changelog">
              <span className="sm:hidden">Ver</span>
              <span className="hidden sm:inline">Ver novidades</span>
            </Link>
          </Button>
          <Button
            aria-label="Dispensar aviso desta versão"
            disabled={markSeenMutation.isPending}
            onClick={dismiss}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
