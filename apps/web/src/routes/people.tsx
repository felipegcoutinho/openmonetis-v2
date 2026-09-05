import { createFileRoute } from "@tanstack/react-router";
import { PeoplePage } from "@/features/people/components/people-page";
export const Route = createFileRoute("/people")({ component: PeoplePage });
