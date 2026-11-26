import type { ReactNode, SyntheticEvent } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isDemo } from "@/demo/mode";

function allowed(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-demo-allow], [data-slot='tooltip-trigger']"));
}

function block(event: SyntheticEvent) {
  if (allowed(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
}

/** Empêche toute modification sans griser la page : l'aperçu et les infobulles restent utilisables. */
export function DemoLock({ children }: { children: ReactNode }) {
  if (!isDemo) return children;
  return (
    <div
      onPointerDownCapture={(event) => {
        if (!allowed(event.target)) event.stopPropagation();
      }}
      onClickCapture={block}
      onDoubleClickCapture={block}
      onChangeCapture={block}
      onInputCapture={block}
      onBeforeInputCapture={block}
      onDragStartCapture={block}
      onSubmitCapture={block}
      onKeyDownCapture={(event) => {
        if (event.key === "Tab" || event.key === "Escape") return;
        block(event);
      }}
    >
      {children}
    </div>
  );
}

export function DemoBanner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Alert className="mb-6 border-2 border-amber-700 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-300 dark:bg-amber-950 dark:text-amber-50">
      <TriangleAlertIcon className="text-amber-800 dark:text-amber-200" />
      <AlertTitle className="text-base font-semibold text-amber-950 dark:text-amber-50">{title}</AlertTitle>
      <AlertDescription className="text-amber-950 dark:text-amber-100">{children}</AlertDescription>
    </Alert>
  );
}
