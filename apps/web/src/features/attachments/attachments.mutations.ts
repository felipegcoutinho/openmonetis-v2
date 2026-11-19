import { useMutation, useQueryClient } from "@tanstack/react-query";
import { noteKeys } from "../notes/notes.queries";
import { transactionKeys } from "../transactions/transactions.queries";
import {
  deleteAttachment,
  detachNoteAttachment,
  detachTransactionAttachment,
  uploadAttachment,
  uploadNoteAttachment,
} from "./attachments.api";
import { attachmentKeys } from "./attachments.queries";

export function useUploadAttachmentMutation(transactionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadAttachment(file, transactionId),
    onSuccess: () => invalidateAttachmentConsumers(queryClient, transactionId),
  });
}

export function useDetachAttachmentMutation(transactionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => detachTransactionAttachment(transactionId, attachmentId),
    onSuccess: () => invalidateAttachmentConsumers(queryClient, transactionId),
  });
}

export function useUploadNoteAttachmentMutation(noteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadNoteAttachment(file, noteId),
    onSettled: () => invalidateNoteAttachmentConsumers(queryClient, noteId),
  });
}

export function useDetachNoteAttachmentMutation(noteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => detachNoteAttachment(noteId, attachmentId),
    onSuccess: () => invalidateNoteAttachmentConsumers(queryClient, noteId),
  });
}

export function useDeleteAttachmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: attachmentKeys.all }),
        queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
        queryClient.invalidateQueries({ queryKey: noteKeys.all }),
      ]),
  });
}

function invalidateNoteAttachmentConsumers(
  queryClient: ReturnType<typeof useQueryClient>,
  noteId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: attachmentKeys.note(noteId) }),
    queryClient.invalidateQueries({ queryKey: noteKeys.all }),
  ]);
}

function invalidateAttachmentConsumers(
  queryClient: ReturnType<typeof useQueryClient>,
  transactionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: attachmentKeys.transaction(transactionId) }),
    queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
  ]);
}
