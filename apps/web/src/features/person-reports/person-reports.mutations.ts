import type {
  CreatePersonReportDeliveryInput,
  UpdatePersonReportScheduleInput,
} from "@openmonetis/validators/person-reports";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPersonReportDelivery, updatePersonReportSchedule } from "./person-reports.api";
import { personReportKeys } from "./person-reports.queries";

export function useSendPersonReportMutation(personId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePersonReportDeliveryInput) =>
      createPersonReportDelivery(personId, input),
    // A failed attempt is also recorded, so the history refreshes either way.
    onSettled: () => client.invalidateQueries({ queryKey: personReportKeys.deliveries(personId) }),
  });
}

export function useUpdatePersonReportScheduleMutation(personId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePersonReportScheduleInput) =>
      updatePersonReportSchedule(personId, input),
    onSuccess: (state) => client.setQueryData(personReportKeys.schedule(personId), state),
  });
}
