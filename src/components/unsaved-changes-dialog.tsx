import { Loader2Icon, SaveIcon, Undo2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { SectionChanges } from "@/lib/preferences-form";

interface StockOverflow {
  stocks: number;
  categories: number;
  limit: number;
  pages: number;
  onTrim: () => void;
}

interface UnsavedChangesDialogProps {
  open: boolean;
  changes: SectionChanges[];
  saving: boolean;
  stockOverflow?: StockOverflow | null;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

/** Demande quoi faire des préférences non enregistrées avant de quitter la page. */
export function UnsavedChangesDialog({ open, changes, saving, stockOverflow, onStay, onDiscard, onSave }: UnsavedChangesDialogProps) {
  const { t } = useI18n();
  const leave = t.preferences.leave;
  const labels = t.preferences.changes;
  const overflow = stockOverflow && (stockOverflow.stocks > stockOverflow.limit || stockOverflow.categories > stockOverflow.limit)
    ? stockOverflow
    : null;
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !saving && onStay()}>
      <AlertDialogContent className="data-[size=default]:sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{overflow ? leave.stocksTitle : leave.title}</AlertDialogTitle>
          <AlertDialogDescription className={overflow ? "font-medium text-destructive" : undefined}>
            {overflow
              ? `${t.preferences.stocksPageWarning(overflow.stocks, overflow.categories, overflow.limit, overflow.pages)} ${leave.stocksNext}`
              : leave.description(changes.length)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[min(50svh,26rem)] space-y-4 overflow-y-auto rounded-lg border bg-muted/30 p-3">
          {changes.map((section) => (
            <section key={section.section} aria-labelledby={`unsaved-${section.section}`}>
              <h3 id={`unsaved-${section.section}`} className="text-sm font-semibold">
                {section.title}
              </h3>
              <ul className="mt-1.5 space-y-2">
                {section.changes.map((change) => (
                  <li key={change.label} className="text-sm">
                    <span className="font-medium">{change.label}</span>
                    <div className="flex flex-wrap items-baseline gap-x-2 wrap-anywhere">
                      <span className="text-muted-foreground">
                        <span className="sr-only">{labels.before} </span>
                        <del>{change.before}</del>
                      </span>
                      <span aria-hidden="true" className="text-muted-foreground">
                        →
                      </span>
                      <span>
                        <span className="sr-only">{labels.after} </span>
                        <ins className="font-medium no-underline">{change.after}</ins>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{overflow ? leave.stocksStay : leave.stay}</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={saving} onClick={onDiscard}>
            <Undo2Icon />
            {leave.discard}
          </Button>
          {overflow ? (
            <Button type="button" disabled={saving} onClick={overflow.onTrim}>
              {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              {leave.stocksTrim}
            </Button>
          ) : (
            <Button type="button" disabled={saving} onClick={onSave}>
              {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              {leave.saveAll}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
