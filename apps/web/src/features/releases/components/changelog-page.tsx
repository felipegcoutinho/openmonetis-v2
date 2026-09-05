import { useQuery } from "@tanstack/react-query";
import { ExternalLink, History, RefreshCw } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatReleaseDate,
  releaseErrorMessage,
  releaseSectionLabels,
} from "../releases.presentation";
import { releasesQueryOptions } from "../releases.queries";

export function ChangelogPage() {
  const releasesQuery = useQuery(releasesQueryOptions());

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container text-left">
          <PageHeader
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Changelog" }]}
            description="Acompanhe novidades, melhorias e correções disponíveis no OpenMonetis."
            eyebrow="Aplicativo"
            icon={<History aria-hidden="true" className="size-5" />}
            title="Changelog"
          />

          {releasesQuery.isPending ? <ChangelogSkeleton /> : null}

          {releasesQuery.isError ? (
            <Card className="ring-1 ring-border">
              <CardContent>
                <div className="flex w-full max-w-4xl flex-col items-start gap-4">
                  <p className="text-muted-foreground text-sm">{releaseErrorMessage()}</p>
                  <Button onClick={() => releasesQuery.refetch()} type="button" variant="outline">
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Tentar novamente
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {releasesQuery.data ? (
            <div className="grid gap-5">
              {releasesQuery.data.updateAvailable &&
              releasesQuery.data.latestVersion &&
              releasesQuery.data.latestReleaseUrl ? (
                <Card className="border-brand/30 bg-brand/5">
                  <CardContent>
                    <div className="flex w-full max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">
                          Versão {releasesQuery.data.latestVersion} disponível
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Esta instalação está na versão {releasesQuery.data.currentVersion}.
                        </p>
                      </div>
                      <Button asChild variant="outline">
                        <a
                          href={releasesQuery.data.latestReleaseUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Ver release
                          <ExternalLink aria-hidden="true" className="size-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {releasesQuery.data.releases.map((release) => (
                <article id={`v-${release.version.replaceAll(".", "-")}`} key={release.version}>
                  <Card className="ring-1 ring-border">
                    <div className="grid w-full max-w-4xl gap-6 text-left">
                      <CardHeader className="gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="font-mono text-xl">v{release.version}</CardTitle>
                          {release.isCurrent ? <Badge>Atual</Badge> : null}
                          <time className="text-muted-foreground text-xs" dateTime={release.date}>
                            {formatReleaseDate(release.date)}
                          </time>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {release.summary}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-5 border-border border-t pt-5">
                          {release.sections.map((section) => (
                            <section className="grid gap-2" key={section.type}>
                              <h2 className="font-medium text-sm">
                                {releaseSectionLabels[section.type]}
                              </h2>
                              <ul className="grid gap-2 pl-5 text-muted-foreground text-sm leading-relaxed">
                                {section.items.map((item) => (
                                  <li className="list-disc" key={item}>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ))}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </ProtectedRoute>
  );
}

function ChangelogSkeleton() {
  return (
    <div className="grid gap-5">
      {[0, 1].map((item) => (
        <Card key={item}>
          <div className="w-full max-w-4xl px-6 text-left">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
          </div>
        </Card>
      ))}
    </div>
  );
}
