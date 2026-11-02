import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { api, queryKeys } from "@/lib/api";
import { messages, useI18n } from "@/lib/i18n";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : messages().common.unexpected;
}

export function useGenerateEdition() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useI18n();
  return useMutation({
    mutationFn: api.createEdition,
    onSuccess: (edition) => {
      queryClient.setQueryData(queryKeys.edition(edition.id), edition);
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success(t.common.generationStarted);
      void navigate({ to: "/editions/$id", params: { id: edition.id } });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/** `onDeleted` s'exécute avant l'oubli des détails en cache, pour quitter d'abord une page qui les affiche. */
export function useDeleteEditions(onDeleted?: () => unknown) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: api.deleteEditions,
    onSuccess: async ({ deleted, editions }) => {
      queryClient.setQueryData(queryKeys.editions, editions);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success(t.editions.deleted(deleted.length));
      await onDeleted?.();
      for (const id of deleted) queryClient.removeQueries({ queryKey: queryKeys.edition(id), exact: true });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
