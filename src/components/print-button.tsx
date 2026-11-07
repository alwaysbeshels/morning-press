import { useState, type ComponentProps } from "react";
import { Loader2Icon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { editionUrls } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { printEdition } from "@/lib/documents";

type PrintButtonProps = Omit<ComponentProps<typeof Button>, "asChild" | "children" | "onClick"> & {
  editionId: string;
  /** Icône seule (liste des éditions) : le libellé sert alors d'étiquette accessible. */
  iconOnly?: boolean;
};

export function PrintButton({ editionId, iconOnly = false, disabled, ...props }: PrintButtonProps) {
  const { t, language } = useI18n();
  const [printing, setPrinting] = useState(false);
  const label = iconOnly ? t.editions.printPdf : t.edition.print;

  const print = async () => {
    setPrinting(true);
    try {
      await printEdition(editionUrls.pdf(editionId), editionUrls.print(editionId, language));
    } catch {
      toast.error(t.edition.printFailed, {
        action: { label: t.edition.printView, onClick: () => window.location.assign(editionUrls.print(editionId, language)) },
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
