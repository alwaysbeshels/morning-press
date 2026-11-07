import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, DownloadIcon, ExternalLinkIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { DeleteEditionsDialog } from "@/components/delete-editions-dialog";
import { EditionStatusBadge } from "@/components/edition-status";
import { PageHeader } from "@/components/layout";
import { PrintButton } from "@/components/print-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, editionUrls, queryKeys } from "@/lib/api";
import { canDeleteEdition } from "@/lib/editions";
import { formatDateTime, formatEditionDate, formatTime } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { describeSourceError, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const route = getRouteApi("/editions/$id");

// Largeur d'une page Lettre (8,5 po à 96 ppp), sous laquelle la mise en page du journal ne tient plus.
const PAGE_WIDTH = 816;

/** Sur un écran étroit (téléphone), le journal garde la largeur d'une page et s'affiche réduit, comme le PDF. */
function EditionFrame({ src, title, pages }: { src: string; title: string; pages: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => setScale(Math.min(1, element.clientWidth / PAGE_WIDTH));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={container}
      className={cn("relative box-content overflow-hidden rounded-xl border bg-white shadow-sm", pages === 2 ? "aspect-[8.5/22.75]" : "aspect-[8.5/11.5]")}
    >
      <iframe
        title={title}
        src={src}
        sandbox=""
        className="absolute top-0 left-0"
        style={{ width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      />
    </div>
  );
}

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
                  <PrintButton editionId={data.id} variant="outline" />
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

      {available && data.hasHtml && <EditionFrame src={editionUrls.html(data.id)} title={e.frameTitle(date)} pages={pages} />}
    </>
  );
}
