import type { ReactElement } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteEditions } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";

interface DeleteEditionsDialogProps {
  ids: string[];
  title: string;
  description: string;
  onDeleted?: () => unknown;
  /** Bouton déclencheur, désactivé par l'appelant pendant la suppression. */
  trigger: (pending: boolean) => ReactElement;
}

export function DeleteEditionsDialog({ ids, title, description, onDeleted, trigger }: DeleteEditionsDialogProps) {
  const { t } = useI18n();
  const remove = useDeleteEditions(onDeleted);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger(remove.isPending)}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.editions.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => remove.mutate(ids)}>
            {t.editions.deleteConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
