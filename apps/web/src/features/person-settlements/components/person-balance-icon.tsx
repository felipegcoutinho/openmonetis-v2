import type { PersonBalanceOutput } from "@openmonetis/validators/person-settlements";
import { CircleCheck, Clock, PiggyBank } from "lucide-react";

const personBalanceIcons = {
  credit: PiggyBank,
  receivable: Clock,
  settled: CircleCheck,
} as const;

export function PersonBalanceIcon({ status }: { status: PersonBalanceOutput["status"] }) {
  const Icon = personBalanceIcons[status];
  return <Icon aria-hidden="true" />;
}
