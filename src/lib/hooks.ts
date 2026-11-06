import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError, api, queryKeys } from "@/lib/api";
import { messages, useI18n } from "@/lib/i18n";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : messages().common.unexpected;
}

/** Cloudflare Access a refusé la requête : la session a expiré. */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Affiche une erreur dans un toast. Une session expirée garde un seul toast, avec un bouton
 * pour se reconnecter : l'application installée (mode autonome) n'a pas de bouton Recharger.
 */
export function showError(error: unknown) {
  if (!isSessionExpired(error)) {
    toast.error(errorMessage(error));
    return;
  }
  const { common } = messages();
  toast.error(common.sessionExpired, {
    id: "session-expired",
    duration: Infinity,
    action: { label: common.signInAgain, onClick: () => window.location.reload() },
  });
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
    onError: showError,
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
    onError: showError,
  });
}
