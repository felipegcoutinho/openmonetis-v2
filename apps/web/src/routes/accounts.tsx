import { createFileRoute } from "@tanstack/react-router";
import { AccountsPage } from "@/features/accounts/components/accounts-page";

export const Route = createFileRoute("/accounts")({ component: AccountsPage });
