import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, DownloadIcon, ExternalLinkIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { DeleteEditionsDialog } from "@/components/delete-editions-dialog";
import { EditionStatusBadge } from "@/components/edition-status";
import { PageHeader } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, editionUrls, queryKeys } from "@/lib/api";
import { canDeleteEdition } from "@/lib/editions";
import { formatDateTime, formatEditionDate, formatTime } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { describeSourceError, useI18n } from "@/lib/i18n";

const route = getRouteApi("/editions/$id");

export function EditionPage() {
  const { id } = route.useParams();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const e = t.edition;
  const edition = useQuery({
    queryKey: queryKeys.edition(id),
    queryFn: () => api.edition(id),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3000 : false),
  });

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/editions">
        <ArrowLeftIcon /> {e.back}
      </Link>
    </Button>
  );

  if (edition.isPending) return <>{back}<Skeleton className="h-[80vh]" /></>;
  if (edition.isError) {
    return (
      <>
        {back}
        <Alert variant="destructive">
          <AlertTitle>{e.notFound}</AlertTitle>
          <AlertDescription>{errorMessage(edition.error)}</AlertDescription>
        </Alert>
      </>
    );
  }

  const data = edition.data;
  const available = !data.expired;
  const date = formatEditionDate(data.editionDate, language);
  const pages = data.stats?.pages ?? 1;

  return (
    <>
      {back}
      <PageHeader
        title={date}
        description={e.generatedOn(formatDateTime(data.createdAt, language))}
        actions={
          (available && data.hasPdf) || canDeleteEdition(data) ? (
            <>
              {available && data.hasPdf && (
                <>
                  <Button asChild variant="outline">
                    <a href={editionUrls.pdf(data.id)} target="_blank" rel="noopener">
                      <ExternalLinkIcon /> {e.openPdf}
                    </a>
                  </Button>
                  <Button asChild>
                    <a href={editionUrls.download(data.id)}>
                      <DownloadIcon /> {e.download}
                    </a>
                  </Button>
                </>
              )}
              {canDeleteEdition(data) && (
                <DeleteEditionsDialog
                  ids={[data.id]}
                  title={t.editions.deleteTitle}
                  description={t.editions.deleteText(date, formatTime(data.createdAt, language))}
                  onDeleted={() => navigate({ to: "/editions" })}
                  trigger={(pending) => (
                    <Button variant="outline" className="text-destructive hover:text-destructive" disabled={pending}>
                      {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />} {e.delete}
                    </Button>
                  )}
                />
              )}
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <EditionStatusBadge edition={data} />
        {data.errors.map((error) => (
          <span key={`${error.source}-${error.message}`} className="text-sm text-muted-foreground">
            {describeSourceError(error, t)}
          </span>
        ))}
      </div>

      {data.status === "running" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-24 text-muted-foreground">
          <Loader2Icon className="size-8 animate-spin" aria-hidden />
          <p>{e.preparing}</p>
        </div>
      )}
      {data.status === "failed" && !data.hasHtml && (
        <Alert variant="destructive">
          <AlertTitle>{e.failedTitle}</AlertTitle>
          <AlertDescription>{e.failedText}</AlertDescription>
        </Alert>
      )}
      {data.expired && <p className="text-muted-foreground">{e.expired}</p>}

      {available && data.hasHtml && (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <iframe
            title={e.frameTitle(date)}
            src={editionUrls.html(data.id)}
            sandbox=""
            className={pages === 2 ? "aspect-[8.5/22.75] w-full" : "aspect-[8.5/11.5] w-full"}
          />
        </div>
      )}
    </>
  );
}
