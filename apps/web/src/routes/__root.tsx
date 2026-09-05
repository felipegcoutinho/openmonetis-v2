import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  type ErrorComponentProps,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { PrivacyProvider } from "@/components/privacy-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreferencesSynchronizer } from "@/features/preferences/components/preferences-synchronizer";
import { siteName } from "@/lib/seo";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: siteName,
      },
      {
        name: "description",
        content: "Aplicação web de controle financeiro pessoal.",
      },
      {
        name: "robots",
        content: "noindex, nofollow, noarchive",
      },
      {
        name: "googlebot",
        content: "noindex, nofollow, noarchive",
      },
      {
        name: "theme-color",
        content: "#fc941d",
      },
      {
        name: "apple-mobile-web-app-title",
        content: siteName,
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "48x48 32x32 24x24 16x16",
      },
      {
        rel: "icon",
        href: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
  }),
  component: RootApp,
  errorComponent: RootErrorComponent,
  notFoundComponent: () => (
    <main className="project-container grid min-h-svh place-items-center px-4 py-12">
      <div className="grid gap-3 text-center">
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-muted-foreground">O endereço acessado não existe no OpenMonetis.</p>
      </div>
    </main>
  ),
  shellComponent: RootDocument,
});

function RootErrorComponent({ reset }: ErrorComponentProps) {
  return (
    <main className="project-container grid min-h-svh place-items-center px-4 py-12">
      <div className="grid max-w-md justify-items-center gap-4 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Não foi possível carregar esta página</h1>
          <p className="text-muted-foreground text-sm">
            Tente novamente. Se o aplicativo acabou de ser atualizado, recarregue a página.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset} type="button" variant="outline">
            Tentar novamente
          </Button>
          <Button onClick={() => window.location.reload()} type="button">
            <RefreshCw aria-hidden="true" className="size-4" />
            Recarregar página
          </Button>
        </div>
      </div>
    </main>
  );
}

function RootApp() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <PreferencesSynchronizer />
        <Outlet />
        <Toaster closeButton position="bottom-right" />
      </PrivacyProvider>
    </QueryClientProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider defaultTheme="system">
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
