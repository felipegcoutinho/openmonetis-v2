import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";

import { Image } from "@unpic/react";

export function EntityOption({
  entity,
}: {
  entity?: Pick<AccountOutput, "name" | "logo"> | Pick<CardOutput, "name" | "logo">;
}) {
  if (!entity) return <span>Selecione</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {entity.logo ? (
        <Image
          alt=""
          className="size-5 rounded-full object-contain"
          height={20}
          layout="fixed"
          src={entity.logo}
          width={20}
        />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-muted text-[9px]">
          {entity.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="truncate">{entity.name}</span>
    </span>
  );
}
