import { useCallback, useEffect, useMemo, useState } from "react";
import type { Language } from "@shared/types";
import { applyLanguage, getLanguage, I18nContext, i18nValue, rememberLanguage } from "@/lib/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getLanguage);

  useEffect(() => applyLanguage(language), [language]);

  const setLanguage = useCallback((next: Language) => {
    // Appliquée tout de suite pour que les requêtes suivantes envoient la bonne langue.
    applyLanguage(next);
    rememberLanguage(next);
    setLanguageState(next);
  }, []);

  const value = useMemo(() => i18nValue(language, setLanguage), [language, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
