import { createFileRoute, Link } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/login-form";
import { PublicOnlyRoute } from "@/components/auth/public-only-route";
import { OpenMonetisLogo } from "@/components/openmonetis-logo";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Entrar · OpenMonetis" }] }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <PublicOnlyRoute>
      <main className="relative isolate grid min-h-svh place-items-center overflow-hidden bg-background px-4 py-16">
        <div
          aria-hidden="true"
          className="atmospheric-wash absolute top-1/2 left-1/2 -z-10 size-[min(42rem,90vw)] -translate-x-1/2 -translate-y-1/2 opacity-55"
        />
        <Link className="absolute top-24 left-1/2 -translate-x-1/2" to="/">
          <OpenMonetisLogo />
        </Link>
        <section className="w-full max-w-md rounded-card border border-border bg-background/85 p-6 backdrop-blur-md sm:p-8">
          <h1 className="mt-3 font-heading text-4xl font-normal">Entrar</h1>
          <p className="mt-3 text-muted-foreground text-sm">
            Acesse seu controle financeiro do OpenMonetis.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
          <p className="mt-6 text-center text-muted-foreground text-sm">
            Ainda não tem conta?{" "}
            <Link className="font-medium text-brand-strong hover:underline" to="/signup">
              Criar conta
            </Link>
          </p>
        </section>
      </main>
    </PublicOnlyRoute>
  );
}
