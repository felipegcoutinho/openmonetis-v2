import { queryOptions } from "@tanstack/react-query";
import {
  getPersonReport,
  getPersonReportDeliveries,
  getPersonReportDocument,
  getPersonReportSchedule,
} from "./person-reports.api";

export const personReportKeys = {
  all: ["person-reports"] as const,
  detail: (personId: string, period: string) => ["person-reports", personId, period] as const,
  document: (personId: string, period: string) =>
    ["person-reports", personId, period, "document"] as const,
  deliveries: (personId: string) => ["person-reports", personId, "deliveries"] as const,
  schedule: (personId: string) => ["person-reports", personId, "schedule"] as const,
};

export const personReportQueryOptions = (personId: string, period: string) =>
  queryOptions({
    queryKey: personReportKeys.detail(personId, period),
    queryFn: () => getPersonReport(personId, period),
  });

export const personReportDeliveriesQueryOptions = (personId: string) =>
  queryOptions({
    queryKey: personReportKeys.deliveries(personId),
    queryFn: () => getPersonReportDeliveries(personId),
  });

export const personReportScheduleQueryOptions = (personId: string) =>
  queryOptions({
    queryKey: personReportKeys.schedule(personId),
    queryFn: () => getPersonReportSchedule(personId),
  });

/** Generated on demand, with the issue time printed on it: never served from the cache. */
export const personReportDocumentQueryOptions = (personId: string, period: string) =>
  queryOptions({
    queryKey: personReportKeys.document(personId, period),
    queryFn: () => getPersonReportDocument(personId, period),
    staleTime: 0,
    gcTime: 0,
  });
