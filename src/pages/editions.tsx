import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DownloadIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { EditionStatusBadge } from "@/components/edition-status";
import { PageHeader } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, editionUrls, queryKeys } from "@/lib/api";
import { formatDateTime, formatEditionDate } from "@/lib/format";
import { errorMessage, useGenerateEdition } from "@/lib/hooks";
import { sourceErrorLabel, useI18n } from "@/lib/i18n";

export function EditionsPage() {
  const editions = useQuery({
    queryKey: queryKeys.editions,
    queryFn: api.editions,
    refetchInterval: (query) => (query.state.data?.some((edition) => edition.status === "running") ? 4000 : false),
  });
  const generate = useGenerateEdition();
  const { t, language } = useI18n();

  return (
    <>
      <PageHeader
        title={t.nav.editions}
        description={t.editions.description}
        actions={
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {t.common.generateNow}
          </Button>
        }
      />

      {editions.isPending && <Skeleton className="h-64" />}
      {editions.isError && (
        <Alert variant="destructive">
          <AlertTitle>{t.editions.loadError}</AlertTitle>
          <AlertDescription>{errorMessage(editions.error)}</AlertDescription>
        </Alert>
      )}
      {editions.data?.length === 0 && <p className="text-muted-foreground">{t.editions.empty}</p>}

      {editions.data && editions.data.length > 0 && (
        <Card className="py-0">
          <CardContent className="px-0">
            <ul className="divide-y">
              {editions.data.map((edition) => {
                const available = !edition.expired && edition.status !== "running";
                return (
                  <li key={edition.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        to="/editions/$id"
                        params={{ id: edition.id }}
                        className="font-medium hover:underline"
                      >
                        {formatEditionDate(edition.editionDate, language)}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {t.trigger[edition.trigger]} · {formatDateTime(edition.createdAt, language)}
                        {edition.errors.length > 0 &&
                          ` · ${t.editions.unavailable([...new Set(edition.errors.map((error) => sourceErrorLabel(error, t)))].join(", "))}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <EditionStatusBadge edition={edition} />
                      {available && edition.hasPdf && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={editionUrls.download(edition.id)} aria-label={t.editions.downloadPdf}>
                            <DownloadIcon /> PDF
                          </a>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
