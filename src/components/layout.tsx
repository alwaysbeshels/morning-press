import { useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { NewspaperIcon } from "lucide-react";
import { api, queryKeys } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const NAV = [
  { to: "/", key: "dashboard" },
  { to: "/editions", key: "editions" },
  { to: "/comptes", key: "accounts" },
  { to: "/preferences", key: "preferences" },
] as const;

export function Layout() {
  const { t, setLanguage } = useI18n();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: api.me, staleTime: Infinity });
  const savedLanguage = me.data?.language;

  // La langue enregistrée dans les préférences l'emporte sur celle du navigateur.
  useEffect(() => {
    if (savedLanguage) setLanguage(savedLanguage);
  }, [savedLanguage, setLanguage]);

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-2">
            <NewspaperIcon className="size-6" aria-hidden />
            <span className="font-heading text-xl font-bold tracking-tight">{t.appName}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <nav aria-label={t.nav.label} className="flex flex-wrap gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  activeProps={{ className: "bg-muted font-medium text-foreground" }}
                >
                  {t.nav[item.key]}
                </Link>
              ))}
            </nav>
            {me.data && <span className="hidden text-xs text-muted-foreground md:inline">{me.data.email}</span>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="py-16 text-center">
      <h1 className="font-heading text-2xl font-bold">{t.notFound.title}</h1>
      <Link to="/" className="mt-4 inline-block underline">
        {t.notFound.back}
      </Link>
    </div>
  );
}
