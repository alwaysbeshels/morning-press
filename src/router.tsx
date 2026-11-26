import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Layout, NotFound } from "@/components/layout";
import { AccountsPage } from "@/pages/accounts";
import { DashboardPage } from "@/pages/dashboard";
import { EditionPage } from "@/pages/edition";
import { EditionsPage } from "@/pages/editions";
import { PreferencesPage } from "@/pages/preferences";

interface AccountsSearch {
  connecte?: string;
  erreur?: string;
  avertissement?: string;
}

const optionalString = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : undefined);

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound });

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: DashboardPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/editions", component: EditionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/editions/$id", component: EditionPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/comptes",
    component: AccountsPage,
    validateSearch: (search: Record<string, unknown>): AccountsSearch => ({
      connecte: optionalString(search.connecte),
      erreur: optionalString(search.erreur),
      avertissement: optionalString(search.avertissement),
    }),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: "/preferences", component: PreferencesPage }),
]);

const basepath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createRouter({
  routeTree,
  ...(basepath ? { basepath } : {}),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
