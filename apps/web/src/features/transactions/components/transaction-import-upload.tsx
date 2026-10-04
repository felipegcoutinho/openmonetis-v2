import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { useTransactionImportReview } from "../useTransactionImportReview";

import type { Props } from "./transaction-import-screen.types";

export function TransactionImportUpload({
  inputRef,
  dragging,
  setDragging,
  handleFile,
  downloadTemplate,
  isLoadingOptions,
  isDownloadingTemplate,
  isPreviewing,
}: {
  inputRef: ReturnType<typeof useTransactionImportReview>["inputRef"];
  dragging: ReturnType<typeof useTransactionImportReview>["dragging"];
  setDragging: ReturnType<typeof useTransactionImportReview>["setDragging"];
  handleFile: ReturnType<typeof useTransactionImportReview>["handleFile"];
  downloadTemplate: ReturnType<typeof useTransactionImportReview>["downloadTemplate"];
  isLoadingOptions: Props["isLoadingOptions"];
  isDownloadingTemplate: Props["isDownloadingTemplate"];
  isPreviewing: Props["isPreviewing"];
}) {
  return (
    <Card className="border" aria-labelledby="upload-title">
      <CardHeader className="border-b">
        <CardTitle id="upload-title">Selecione o extrato</CardTitle>
        <CardDescription>Envie um arquivo OFX, QFX ou XLSX de até 5 MB.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className={cn(
            "grid min-h-72 w-full place-items-center border border-dashed px-8 py-12 text-center whitespace-normal shadow-none",
            dragging && "border-brand-strong bg-brand/5 text-foreground",
          )}
          disabled={isPreviewing || isLoadingOptions}
          onClick={() => inputRef.current?.click()}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          type="button"
          variant="outline"
        >
          <span className="grid justify-items-center gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
              {isPreviewing ? (
                <FileSpreadsheet
                  aria-hidden="true"
                  className="size-7 animate-pulse text-brand-strong"
                />
              ) : (
                <Upload aria-hidden="true" className="size-7" />
              )}
            </span>
            <span className="grid gap-1.5">
              <span className="font-medium text-base">
                {isPreviewing
                  ? "Lendo extrato..."
                  : "Arraste o arquivo aqui ou clique para selecionar"}
              </span>
              <span className="font-normal text-muted-foreground text-sm">
                Formatos aceitos: .ofx, .qfx e .xlsx
              </span>
            </span>
          </span>
        </Button>
        <input
          accept=".ofx,.qfx,.xlsx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </CardContent>
      <CardFooter className="flex-col items-start justify-between gap-3 border-t sm:flex-row sm:items-center">
        <p className="text-muted-foreground text-xs">
          Não tem um arquivo compatível? Use o modelo para organizar seus lançamentos.
        </p>
        <Button
          disabled={isDownloadingTemplate}
          onClick={() => void downloadTemplate()}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Download />
          {isDownloadingTemplate ? "Preparando modelo..." : "Baixar modelo XLSX"}
        </Button>
      </CardFooter>
    </Card>
  );
}
