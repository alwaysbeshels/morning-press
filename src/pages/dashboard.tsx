import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClockIcon, Loader2Icon, NewspaperIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { DownloadButton } from "@/components/download-button";
import { EditionStatusBadge } from "@/components/edition-status";
import { PageHeader } from "@/components/layout";
import { PrintButton } from "@/components/print-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, queryKeys } from "@/lib/api";
import { formatClock, formatDateTime, formatEditionDate, formatToday } from "@/lib/format";
import { errorMessage, useGenerateEdition } from "@/lib/hooks";
import { describeSourceError, useI18n } from "@/lib/i18n";

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.dashboard,
    refetchInterval: (query) => (query.state.data?.latestEdition?.status === "running" ? 4000 : false),
  });
  const generate = useGenerateEdition();
  const { t, language } = useI18n();
  const d = t.dashboard;

  const generateButton = (
    <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
      {generate.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
      {t.common.generateNow}
    </Button>
  );

  if (dashboard.isPending) {
    return (
      <>
        <PageHeader title={d.hello} description={formatToday(language)} />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48 md:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </>
    );
  }
  if (dashboard.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{d.loadError}</AlertTitle>
        <AlertDescription>{errorMessage(dashboard.error)}</AlertDescription>
      </Alert>
    );
  }

  const { latestEdition: latest, schedule, nextRunAt, accounts } = dashboard.data;
  const days = t.days.filter((day) => schedule.days.includes(day.value));

  return (
    <>
      <PageHeader title={d.hello} description={formatToday(language)} actions={generateButton} />

      {accounts.total === 0 && (
        <Alert className="mb-4">
          <UsersIcon />
          <AlertTitle>{d.noAccountTitle}</AlertTitle>
          <AlertDescription>
            <p>
              {d.noAccountText}{" "}
              <Link to="/comptes" className="font-medium underline">
                {d.connectAccount}
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}
      {accounts.invalid > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{d.reauthTitle}</AlertTitle>
          <AlertDescription>
            <p>
              {d.reauthText(accounts.invalid)}.{" "}
              <Link to="/comptes" className="font-medium underline">
                {d.reconnect}
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NewspaperIcon className="size-5" aria-hidden /> {d.latestEdition}
            </CardTitle>
            <CardDescription>
              {latest
                ? d.generatedOn(formatEditionDate(latest.editionDate, language), formatDateTime(latest.createdAt, language))
                : d.noEdition}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latest ? (
              <>
                <EditionStatusBadge edition={latest} />
                {latest.stats && (
                  <p className="text-sm text-muted-foreground">
                    {d.stats(latest.stats, latest.stats.game ? t.games[latest.stats.game] : null)}
                  </p>
                )}
                {latest.errors.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-muted-foreground">
                    {latest.errors.map((error) => (
                      <li key={`${error.source}-${error.message}`}>{describeSourceError(error, t)}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{d.firstEditionHint}</p>
            )}
          </CardContent>
          {latest && !latest.expired && latest.status !== "running" && (
            <CardFooter className="flex-wrap gap-2">
              {latest.hasHtml && (
                <Button asChild variant="outline">
                  <Link to="/editions/$id" params={{ id: latest.id }}>
                    {d.read}
                  </Link>
                </Button>
              )}
              {latest.hasPdf && (
                <>
                  <DownloadButton editionId={latest.id} variant="outline">PDF</DownloadButton>
                  <PrintButton editionId={latest.id} variant="outline" />
                </>
              )}
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClockIcon className="size-5" aria-hidden /> {d.nextEdition}
            </CardTitle>
            <CardDescription>
              {schedule.enabled && days.length > 0
                ? `${formatClock(schedule.time, language)} · ${days.length === 7 ? d.everyDay : days.map((day) => day.short).join(", ")}`
                : d.scheduleOff}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{schedule.enabled && nextRunAt ? formatDateTime(nextRunAt, language) : "—"}</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="link" className="px-0">
              <Link to="/preferences">{d.editSchedule}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
