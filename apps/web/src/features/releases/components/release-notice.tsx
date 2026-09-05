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
      <div className="project-container flex flex-col gap-3 px-[clamp(1rem,3vw,2.5rem)] py-3 sm:flex-row sm:items-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand-strong">
          <Megaphone aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">Novidades da versão {currentRelease.version}</p>
          <p className="line-clamp-2 text-muted-foreground text-sm">{currentRelease.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link onClick={dismiss} to="/changelog">
              Ver novidades
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
