import type { AccountOutput } from "@openmonetis/validators/accounts";

import { Image } from "@unpic/react";

export function AccountOption({ account }: { account: AccountOutput }) {
  return (
    <span className="flex items-center gap-2">
      {account.logo ? (
        <Image
          alt=""
          className="size-5 rounded-full object-contain"
          height={20}
          layout="fixed"
          src={account.logo}
          width={20}
        />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-muted text-[9px]">
          {account.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span>{account.name}</span>
    </span>
  );
}
