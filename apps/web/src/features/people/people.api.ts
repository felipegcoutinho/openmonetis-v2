import type {
  CreatePersonInput,
  PersonFinancialSummaryOutput,
  PersonOutput,
  ReplacePersonInput,
} from "@openmonetis/validators/people";
import { requestApi as request } from "@/lib/api-client";

export const getPeople = () => request<PersonOutput[]>("/people");
export const getPerson = (id: string) =>
  request<PersonOutput>(id === "admin" ? "/people/admin" : `/people/${id}`);
export const getPersonFinancialSummary = (id: string, period: string) =>
  request<PersonFinancialSummaryOutput>(`/people/${id}/summary?period=${period}`);
export const createPerson = (input: CreatePersonInput) =>
  request<PersonOutput>("/people", { method: "POST", body: JSON.stringify(input) });
export const replacePerson = (id: string, input: ReplacePersonInput) =>
  request<PersonOutput>(`/people/${id}`, { method: "PUT", body: JSON.stringify(input) });
export const deletePerson = (id: string) =>
  request<{ id: string }>(`/people/${id}`, { method: "DELETE" });
