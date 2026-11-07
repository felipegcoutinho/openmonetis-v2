import { useQueryClient } from "@tanstack/react-query";
import { FileDown, Loader } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { printHtmlDocument } from "@/lib/print-document";
import { personReportDocumentQueryOptions } from "../person-reports.queries";

/** Saves the same statement sent by email through the browser's "Salvar como PDF". */
export function PersonReportPdfButton({
  className,
  disabled,
  period,
  personId,
}: {
  className?: string;
  disabled: boolean;
  period: string;
  personId: string;
}) {
  const queryClient = useQueryClient();
  const [isPreparing, setIsPreparing] = useState(false);

  async function saveAsPdf() {
    setIsPreparing(true);
    try {
      const document = await queryClient.fetchQuery(
        personReportDocumentQueryOptions(personId, period),
      );
      await printHtmlDocument(document);
    } catch {
      toast.error("Não foi possível gerar o PDF do extrato.");
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <Button
      className={className}
      disabled={disabled || isPreparing}
      onClick={saveAsPdf}
      size="sm"
      title="Abre a impressão do navegador para salvar como PDF"
      variant="outline"
    >
      {isPreparing ? (
        <Loader aria-hidden="true" className="animate-spin" />
      ) : (
        <FileDown aria-hidden="true" />
      )}
      Salvar PDF
    </Button>
  );
}
