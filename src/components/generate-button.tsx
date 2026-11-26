import { Loader2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isDemo } from "@/demo/mode";
import { useGenerateEdition } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";

/** Dans la démo, le bouton reste visible mais ne lance rien : les journaux sont déjà écrits. */
export function GenerateButton() {
  const { t } = useI18n();
  const generate = useGenerateEdition();

  if (isDemo) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Button type="button" disabled className="pointer-events-none">
              <SparklesIcon />
              {t.common.generateNow}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-72 text-pretty leading-relaxed">
          {t.demo.generateHint}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button type="button" onClick={() => generate.mutate()} disabled={generate.isPending}>
      {generate.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
      {t.common.generateNow}
    </Button>
  );
}
