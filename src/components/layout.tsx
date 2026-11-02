import { useEffect, useRef } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { NewspaperIcon } from "lucide-react";
import { LANGUAGES } from "@shared/types";
import { api, queryKeys } from "@/lib/api";
import { hasRememberedLanguage, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "dashboard" },
  { to: "/editions", key: "editions" },
  { to: "/comptes", key: "accounts" },
  { to: "/preferences", key: "preferences" },
] as const;

/** Langue de l'interface seulement ; celle du journal reste dans les préférences. */
function LanguageSwitcher() {
  const { t, language, setLanguage } = useI18n();
  return (
    <div role="group" aria-label={t.nav.siteLanguage} className="flex shrink-0 rounded-lg border bg-background p-0.5">
      {LANGUAGES.map((value) => {
        const active = language === value;
        return (
          <button key={value} type="button" lang={value} title={t.languageNames[value]} aria-pressed={active}
            onClick={() => setLanguage(value)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}>
            {value.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

export function Layout() {
  const { t, setLanguage } = useI18n();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: api.me, staleTime: Infinity });
  const savedLanguage = me.data?.language;
  const header = useRef<HTMLElement>(null);

  // Première visite sur ce navigateur : le site prend la langue du journal, ensuite le choix du menu est retenu.
  useEffect(() => {
    if (savedLanguage && !hasRememberedLanguage()) setLanguage(savedLanguage);
  }, [savedLanguage, setLanguage]);

  // Hauteur de la barre collante, pour que le défilement vers un champ ne le cache pas dessous.
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--app-header-height", `${element.offsetHeight}px`));
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--app-header-height");
    };
  }, []);

  return (
    <div className="min-h-svh bg-background">
      <header ref={header} className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/85">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:flex-nowrap sm:gap-x-4 sm:py-3">
          <Link to="/" className="mr-auto flex items-center gap-2">
            <NewspaperIcon className="size-6" aria-hidden />
            <span className="font-heading text-xl font-bold tracking-tight">{t.appName}</span>
          </Link>
          {/* Sur mobile, la navigation passe sous le logo et le sélecteur de langue reste en haut à droite. */}
          <div className="order-last flex w-full min-w-0 items-center gap-4 sm:order-none sm:w-auto">
            <nav aria-label={t.nav.label} className="-mx-4 flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-2 sm:mx-0 sm:flex-wrap sm:gap-1 sm:overflow-visible sm:px-0">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="shrink-0 rounded-md px-2 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3"
                  activeProps={{ className: "bg-muted font-medium text-foreground" }}
                >
                  {t.nav[item.key]}
                </Link>
              ))}
            </nav>
            {me.data && <span className="hidden text-xs text-muted-foreground lg:inline">{me.data.email}</span>}
          </div>
          <LanguageSwitcher />
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
