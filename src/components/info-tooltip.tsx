import { useRef, useState, type ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Bouton « i » : l'infobulle s'ouvre au survol ou au focus clavier, et d'un toucher sur mobile (pas de survol).
export function InfoTooltip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pointer = useRef({ touch: false, wasOpen: false });
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button ref={triggerRef} type="button" aria-label={label}
          className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
          onPointerDown={(event) => {
            pointer.current = { touch: event.pointerType !== "mouse", wasOpen: open };
            // À la souris, l'infobulle est déjà ouverte par le survol : on empêche Radix de la refermer au clic.
            if (event.pointerType === "mouse" && open) event.preventDefault();
          }}
          onClick={(event) => {
            event.preventDefault();
            setOpen(pointer.current.touch ? !pointer.current.wasOpen : true);
            pointer.current = { touch: false, wasOpen: false };
          }}>
          <InfoIcon className="size-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-64 text-pretty leading-relaxed"
        onPointerDownOutside={(event) => {
          // Le bouton gère lui-même l'ouverture et la fermeture.
          if (event.target instanceof Node && triggerRef.current?.contains(event.target)) event.preventDefault();
        }}>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
