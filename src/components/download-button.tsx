import { useState, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api, editionUrls, queryKeys } from "@/lib/api";
import { sharePdf, usesMobileDocuments } from "@/lib/documents";
import { errorMessage } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";

type DownloadButtonProps = Omit<ComponentProps<typeof Button>, "asChild" | "onClick"> & { editionId: string };

export function DownloadButton({ editionId, children, ...props }: DownloadButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button {...props} asChild>
        <a
          href={editionUrls.download(editionId)}
          download
          aria-label={t.editions.downloadPdf}
          onClick={(event) => {
            if (!usesMobileDocuments()) return;
            event.preventDefault();
            setOpen(true);
          }}
        >
          <DownloadIcon /> {children ?? t.edition.download}
        </a>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        {open && <SavePdfContent editionId={editionId} onSaved={() => setOpen(false)} />}
      </AlertDialog>
    </>
  );
}

function SavePdfContent({ editionId, onSaved }: { editionId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const [sharing, setSharing] = useState(false);
  const pdf = useQuery({
    queryKey: queryKeys.editionPdf(editionId),
    queryFn: ({ signal }) => api.editionPdf(editionId, signal),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
  });
  const supported = pdf.data && navigator.canShare?.({ files: [pdf.data] }) && !!navigator.share;

  const save = async () => {
    if (!pdf.data) {
      toast.error(t.edition.downloadFailed);
      return;
    }
    setSharing(true);
    try {
      // Aucun chargement avant share : iOS doit encore reconnaître le toucher de ce bouton.
      await sharePdf(pdf.data);
      onSaved();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(t.edition.downloadFailed);
    } finally {
      setSharing(false);
    }
  };

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t.editions.downloadPdf}</AlertDialogTitle>
        <AlertDialogDescription>{t.edition.savePdfHelp}</AlertDialogDescription>
      </AlertDialogHeader>
      {pdf.isPending && <p role="status" className="flex items-center gap-2 text-sm"><Loader2Icon className="size-4 animate-spin" /> {t.edition.loadingPdf}</p>}
      {pdf.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(pdf.error)}</p>}
      {pdf.data && !supported && <p role="alert" className="text-sm text-destructive">{t.edition.saveUnsupported}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={sharing}>{t.editions.cancel}</AlertDialogCancel>
        {pdf.isError ? (
          <Button onClick={() => void pdf.refetch()}>{t.edition.retryPdf}</Button>
        ) : (
          <Button onClick={save} disabled={!supported || sharing}>
            {sharing ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} {t.edition.savePdf}
          </Button>
        )}
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
