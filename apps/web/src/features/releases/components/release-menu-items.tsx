import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, History, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMarkReleaseSeenMutation } from "../releases.mutations";
import { releasesQueryOptions } from "../releases.queries";

export function ReleaseMenuItems({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const releasesQuery = useQuery(releasesQueryOptions(enabled));
  const markSeenMutation = useMarkReleaseSeenMutation();
  const releases = releasesQuery.data;

  if (!releases) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          if (releases.hasUnseenCurrentRelease) {
            markSeenMutation.mutate(releases.currentVersion);
          }
          void navigate({ to: "/changelog" });
        }}
      >
        <History aria-hidden="true" />
        <span className="flex-1">Changelog</span>
        {releases.hasUnseenCurrentRelease ? (
          <>
            <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
            <span className="sr-only">Há novidades</span>
          </>
        ) : null}
        <Badge className="font-mono text-[0.65rem]" variant="outline">
          v{releases.currentVersion}
        </Badge>
      </DropdownMenuItem>
      {releases.updateAvailable && releases.latestVersion && releases.latestReleaseUrl ? (
        <DropdownMenuItem
          onClick={() =>
            window.open(releases.latestReleaseUrl as string, "_blank", "noopener,noreferrer")
          }
        >
          <Megaphone aria-hidden="true" />
          <span className="flex-1">Versão {releases.latestVersion} disponível</span>
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </DropdownMenuItem>
      ) : null}
    </>
  );
}
