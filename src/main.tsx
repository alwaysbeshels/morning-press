import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { isSessionExpired, showError } from "@/lib/hooks";
import { I18nProvider } from "@/components/i18n-provider";
import { router } from "@/router";
import "./index.css";

const queryClient = new QueryClient({
  // Les pages affichent elles-mêmes les erreurs de lecture ; une session expirée ajoute le bouton pour se reconnecter.
  queryCache: new QueryCache({
    onError: (error) => {
      if (isSessionExpired(error)) showError(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx et 503 (configuration manquante) sont définitifs : inutile de réessayer.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && ((error.status >= 400 && error.status < 500) || error.status === 503)) && failureCount < 2,
    },
  },
});

// Le service worker sert seulement une page hors ligne. Absent en développement, où Vite gère le rechargement.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Facultatif : sans service worker, le site fonctionne, sans page hors ligne.
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
);
