import type { AiDataSharingOutput } from "@openmonetis/validators/ai-data-sharing";
import { History, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsRow } from "@/components/settings-row";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useDeleteAiDataHistoryMutation,
  useUpdateAiDataRetentionMutation,
} from "../ai-data-sharing.mutations";
import {
  aiDataRetentionOptions,
  aiDataRetentionValue,
  aiDataSharingErrorMessage,
  formatAiDataHistoryDeleted,
} from "../ai-data-sharing.presentation";

/** How long AI chats and diagnoses stay in OpenMonetis, and a way to delete them all now. */
export function AiDataHistorySettings({ sharing }: { sharing: AiDataSharingOutput }) {
  const retentionMutation = useUpdateAiDataRetentionMutation();
  const deleteMutation = useDeleteAiDataHistoryMutation();
  const [confirming, setConfirming] = useState(false);
  const retentionId = useId();
  const deleteId = useId();
  const current = aiDataRetentionValue(sharing.retentionDays);

  async function chooseRetention(value: string) {
    const option = aiDataRetentionOptions.find((item) => item.value === value);
    if (!option || value === current) return;
    try {
      await retentionMutation.mutateAsync({ retentionDays: option.days });
      toast.success(
        option.days
          ? `Histórico guardado por ${option.label}`
          : "Histórico guardado até você apagar",
      );
    } catch (error) {
      toast.error(aiDataSharingErrorMessage(error));
    }
  }

  async function deleteHistory() {
    try {
      toast.success(formatAiDataHistoryDeleted(await deleteMutation.mutateAsync()));
      setConfirming(false);
    } catch (error) {
      toast.error(aiDataSharingErrorMessage(error));
    }
  }

  return (
    <SettingsSection
      description="Conversas e diagnósticos ficam no OpenMonetis pelo prazo escolhido, contado desde a última atividade, e depois são apagados automaticamente."
      icon={History}
      title="Histórico de IA"
    >
      <div className="divide-y divide-border">
        <SettingsRow
          description="Vale para todas as conversas e diagnósticos."
          id={retentionId}
          label="Guardar histórico por"
        >
          <Select
            disabled={retentionMutation.isPending}
            onValueChange={(value) => {
              if (value) void chooseRetention(value);
            }}
            value={current}
          >
            <SelectTrigger
              aria-describedby={`${retentionId}-description`}
              className="w-full"
              id={retentionId}
            >
              <SelectValue>
                <span className="font-mono">
                  {aiDataRetentionOptions.find((option) => option.value === current)?.label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {aiDataRetentionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="font-mono">{option.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          description="Remove agora todas as conversas e diagnósticos. Não pode ser desfeito."
          id={deleteId}
          label="Apagar histórico de IA"
        >
          <Button
            aria-describedby={`${deleteId}-description`}
            className="w-full text-destructive hover:text-destructive"
            id={deleteId}
            onClick={() => setConfirming(true)}
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden="true" />
            Apagar tudo
          </Button>
        </SettingsRow>
      </div>

      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todo o histórico de IA?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as conversas e todos os diagnósticos serão apagados do OpenMonetis. Isso não
              pode ser desfeito. Permissões e assistentes conectados continuam como estão, e o que
              já foi enviado segue a política de privacidade de cada provedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => void deleteHistory()}
              variant="destructive"
            >
              {deleteMutation.isPending ? "Apagando…" : "Apagar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
