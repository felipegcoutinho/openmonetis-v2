/**
 * Keeps the previous result on screen while another period of the same record loads, but never
 * shows one record's data as a placeholder for a different record.
 */
export function keepPreviousDataForRecord(id: string) {
  return <TData>(previous: TData | undefined, previousQuery?: { queryKey: readonly unknown[] }) =>
    previousQuery?.queryKey.includes(id) ? previous : undefined;
}
