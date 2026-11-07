import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { EditionDto } from "@shared/types";
import { ChevronRightIcon, DownloadIcon, Loader2Icon, SparklesIcon, Trash2Icon } from "lucide-react";
import { DeleteEditionsDialog } from "@/components/delete-editions-dialog";
import { EditionStatusBadge } from "@/components/edition-status";
import { PageHeader } from "@/components/layout";
import { PrintButton } from "@/components/print-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { api, editionUrls, queryKeys } from "@/lib/api";
import { canDeleteEdition, groupEditionsByDate, type EditionGroup } from "@/lib/editions";
import { formatEditionDate, formatTime } from "@/lib/format";
import { errorMessage, useGenerateEdition } from "@/lib/hooks";
import { sourceErrorLabel, useI18n } from "@/lib/i18n";

export function EditionsPage() {
  const editions = useQuery({
    queryKey: queryKeys.editions,
    queryFn: api.editions,
    refetchInterval: (query) => (query.state.data?.some((edition) => edition.status === "running") ? 4000 : false),
  });
  const generate = useGenerateEdition();
  const { t } = useI18n();

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
              {groupEditionsByDate(editions.data).map((group) => (
                <EditionDay key={group.date} group={group} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** Une date : l'édition la plus récente d'abord, les autres repliées en dessous. */
function EditionDay({ group }: { group: EditionGroup }) {
  const { t, language } = useI18n();
  const ed = t.editions;
  const { latest, older } = group;
  const date = formatEditionDate(group.date, language);
  const all = [latest, ...older];
  const groupDeletable = older.length > 0 && all.every((edition) => canDeleteEdition(edition));

  return (
    <li>
      <Collapsible>
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link to="/editions/$id" params={{ id: latest.id }} className="font-medium hover:underline">
              {date}
            </Link>
            <EditionDetails edition={latest} prefix={older.length > 0 ? ed.latest : undefined} />
            {older.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="link" size="sm" className="group/older mt-0.5 h-auto px-0 text-muted-foreground">
                  <ChevronRightIcon
                    className="transition-transform group-data-[state=open]/older:rotate-90 motion-reduce:transition-none"
                    aria-hidden
                  />
                  {ed.olderToggle(older.length)}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
          <EditionActions edition={latest} date={date} />
        </div>

        {older.length > 0 && (
          <CollapsibleContent className="border-t bg-muted/40">
            <ul className="divide-y">
              {older.map((edition) => (
                <li
                  key={edition.id}
                  className="flex flex-col gap-2 py-2.5 pr-4 pl-8 sm:flex-row sm:items-center sm:justify-between sm:pl-10"
                >
                  <div className="min-w-0">
                    <Link to="/editions/$id" params={{ id: edition.id }} className="text-sm font-medium hover:underline">
                      {ed.at(formatTime(edition.createdAt, language))}
                    </Link>
                    <EditionDetails edition={edition} withTime={false} />
                  </div>
                  <EditionActions edition={edition} date={date} />
                </li>
              ))}
            </ul>
            {groupDeletable && (
              <div className="border-t py-2 pr-4 pl-6 sm:pl-8">
                <DeleteEditionsDialog
                  ids={all.map((edition) => edition.id)}
                  title={ed.deleteGroupTitle(all.length)}
                  description={ed.deleteGroupText(date)}
                  trigger={(pending) => (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={pending}>
                      {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
                      {ed.deleteGroup(all.length)}
                    </Button>
                  )}
                />
              </div>
            )}
          </CollapsibleContent>
        )}
      </Collapsible>
    </li>
  );
}

function EditionDetails({ edition, prefix, withTime = true }: { edition: EditionDto; prefix?: string; withTime?: boolean }) {
  const { t, language } = useI18n();
  const parts = [prefix, t.trigger[edition.trigger], withTime ? formatTime(edition.createdAt, language) : undefined];
  if (edition.errors.length > 0) {
    parts.push(t.editions.unavailable([...new Set(edition.errors.map((error) => sourceErrorLabel(error, t)))].join(", ")));
  }
  return <p className="text-sm text-muted-foreground">{parts.filter(Boolean).join(" · ")}</p>;
}

function EditionActions({ edition, date }: { edition: EditionDto; date: string }) {
  const { t, language } = useI18n();
  const ed = t.editions;
  const time = formatTime(edition.createdAt, language);
  const available = !edition.expired && edition.status !== "running";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <EditionStatusBadge edition={edition} />
      {available && edition.hasPdf && (
        <>
          <Button asChild size="sm" variant="ghost">
            <a href={editionUrls.download(edition.id)} aria-label={ed.downloadPdf}>
              <DownloadIcon /> PDF
            </a>
          </Button>
          <PrintButton editionId={edition.id} size="icon-sm" variant="ghost" iconOnly />
        </>
      )}
      {canDeleteEdition(edition) && (
        <DeleteEditionsDialog
          ids={[edition.id]}
          title={ed.deleteTitle}
          description={ed.deleteText(date, time)}
          trigger={(pending) => (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              aria-label={ed.deleteOne(time)}
              title={ed.deleteOne(time)}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            </Button>
          )}
        />
      )}
    </div>
  );
}
