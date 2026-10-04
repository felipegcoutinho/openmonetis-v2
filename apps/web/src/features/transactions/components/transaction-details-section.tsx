import type { ReactNode } from "react";

export function DetailsSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  const id = `transaction-details-${title.toLocaleLowerCase("pt-BR").replaceAll(" ", "-")}`;

  return (
    <section aria-labelledby={id} className="grid gap-2">
      <SectionTitle icon={icon} id={id}>
        {title}
      </SectionTitle>
      <dl className="grid min-w-0 gap-0 sm:rounded-xl sm:border sm:px-3">{children}</dl>
    </section>
  );
}

export function SectionTitle({
  children,
  icon,
  id,
}: {
  children: ReactNode;
  icon: ReactNode;
  id: string;
}) {
  return (
    <h3
      className="flex items-center gap-2 font-medium text-muted-foreground text-xs sm:text-foreground sm:text-sm"
      id={id}
    >
      <span className="hidden text-muted-foreground sm:inline [&>svg]:size-4">{icon}</span>
      {children}
    </h3>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <dt className="shrink-0 text-muted-foreground text-xs sm:text-sm">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-2 break-words text-right text-xs sm:text-sm">
        {value}
      </dd>
    </div>
  );
}
