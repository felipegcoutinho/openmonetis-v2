import { createFileRoute } from "@tanstack/react-router";
import { ChangelogPage } from "@/features/releases/components/changelog-page";

export const Route = createFileRoute("/changelog")({ component: ChangelogPage });
