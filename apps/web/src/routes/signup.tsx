import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicOnlyRoute } from "@/components/auth/public-only-route";
import { SignupForm } from "@/components/auth/signup-form";
import { OpenMonetisLogo } from "@/components/openmonetis-logo";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta · OpenMonetis" }] }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <PublicOnlyRoute>
      <main className="relative isolate flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden bg-background px-4 py-16">
        <div
          aria-hidden="true"
          className="atmospheric-wash absolute top-1/2 left-1/2 -z-10 size-[min(42rem,90vw)] -translate-x-1/2 -translate-y-1/2 opacity-55"
        />
        <Link to="/">
          <OpenMonetisLogo />
        </Link>
        <section className="w-full max-w-md rounded-card border border-border bg-background/85 p-6 backdrop-blur-md sm:p-8">
          <h1 className="mt-3 font-heading text-4xl font-normal">Criar conta</h1>
          <p className="mt-3 text-muted-foreground text-sm">
            Use sua conta Google ou informe seus dados para começar.
          </p>
          <div className="mt-8">
            <SignupForm />
          </div>
          <p className="mt-6 text-center text-muted-foreground text-sm">
            Já tem conta?{" "}
            <Link className="font-medium text-brand-strong hover:underline" to="/">
              Entrar
            </Link>
          </p>
        </section>
      </main>
    </PublicOnlyRoute>
  );
}
