import { useState, type ComponentProps } from "react";
import { Loader2Icon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { editionUrls } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { printPdf } from "@/lib/print";

type PrintButtonProps = Omit<ComponentProps<typeof Button>, "asChild" | "children" | "onClick"> & {
  editionId: string;
  /** Icône seule (liste des éditions) : le libellé sert alors d'étiquette accessible. */
  iconOnly?: boolean;
};

/** Imprime le PDF d'une édition ; si l'impression ne démarre pas, propose de l'ouvrir pour l'imprimer à la main. */
export function PrintButton({ editionId, iconOnly = false, disabled, ...props }: PrintButtonProps) {
  const { t } = useI18n();
  const [printing, setPrinting] = useState(false);
  const label = iconOnly ? t.editions.printPdf : t.edition.print;

  const print = async () => {
    setPrinting(true);
    try {
      await printPdf(editionUrls.pdf(editionId));
    } catch {
      toast.error(t.edition.printFailed, {
        action: { label: t.edition.openPdf, onClick: () => window.open(editionUrls.pdf(editionId), "_blank", "noopener") },
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Button
      {...props}
      disabled={disabled || printing}
      onClick={print}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      {printing ? <Loader2Icon className="animate-spin" /> : <PrinterIcon />}
      {!iconOnly && label}
    </Button>
  );
}
