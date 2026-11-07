import type {
  CreatePersonReportDeliveryInput,
  PersonReportDeliveriesOutput,
  PersonReportDeliveryOutput,
  PersonReportDocumentOutput,
  PersonReportOutput,
  PersonReportScheduleStateOutput,
  UpdatePersonReportScheduleInput,
} from "@openmonetis/validators/person-reports";
import { requestApi } from "@/lib/api-client";

export function getPersonReport(personId: string, period: string) {
  const query = new URLSearchParams({ period });
  return requestApi<PersonReportOutput>(`/person-reports/${personId}?${query.toString()}`);
}

export function getPersonReportDocument(personId: string, period: string) {
  const query = new URLSearchParams({ period });
  return requestApi<PersonReportDocumentOutput>(
    `/person-reports/${personId}/document?${query.toString()}`,
  );
}

export function getPersonReportDeliveries(personId: string) {
  return requestApi<PersonReportDeliveriesOutput>(`/person-reports/${personId}/deliveries`);
}

export function createPersonReportDelivery(
  personId: string,
  input: CreatePersonReportDeliveryInput,
) {
  return requestApi<PersonReportDeliveryOutput>(`/person-reports/${personId}/deliveries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPersonReportSchedule(personId: string) {
  return requestApi<PersonReportScheduleStateOutput>(`/person-reports/${personId}/schedule`);
}

export function updatePersonReportSchedule(
  personId: string,
  input: UpdatePersonReportScheduleInput,
) {
  return requestApi<PersonReportScheduleStateOutput>(`/person-reports/${personId}/schedule`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
