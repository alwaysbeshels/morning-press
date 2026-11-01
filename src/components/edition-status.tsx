import type { EditionDto } from "@shared/types";
import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

const VARIANTS = {
  running: "secondary",
  ready: "default",
  partial: "outline",
  failed: "destructive",
} as const;

export function EditionStatusBadge({ edition }: { edition: Pick<EditionDto, "status" | "expired"> }) {
  const { t } = useI18n();
  if (edition.expired && edition.status !== "running") return <Badge variant="outline">{t.expired}</Badge>;
  return (
    <Badge variant={VARIANTS[edition.status]}>
      {edition.status === "running" && <Loader2Icon className="animate-spin" aria-hidden />}
      {t.status[edition.status]}
    </Badge>
  );
}
