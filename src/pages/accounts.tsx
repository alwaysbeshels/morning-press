import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { EMAIL_FILTERS, PROVIDER_LABELS, PROVIDERS, type AccountDto, type EmailFilter } from "@shared/types";
import { Loader2Icon, MailXIcon, PlugIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, connectUrl, queryKeys } from "@/lib/api";
import { errorMessage, showError } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";

const route = getRouteApi("/comptes");

export function AccountsPage() {
  const search = route.useSearch();
  const navigate = useNavigate();
  const accounts = useQuery({ queryKey: queryKeys.accounts, queryFn: api.accounts });
  const settings = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const { t } = useI18n();
  const a = t.accounts;

  useEffect(() => {
    if (!search.connecte && !search.erreur) return;
    if (search.erreur) toast.error(a.callbackErrors[search.erreur] ?? a.connectFailed);
    else if (search.avertissement) toast.warning(a.connectedWarning);
    else toast.success(a.connected);
    void navigate({ to: "/comptes", search: {}, replace: true });
  }, [search, navigate, a]);

  return (
    <>
      <PageHeader title={a.title} description={a.description} />

      {settings.data && !settings.data.preferences.emailsEnabled && (
        <Alert className="mb-4">
          <MailXIcon />
          <AlertTitle>{a.emailsOffTitle}</AlertTitle>
          <AlertDescription>
            <p>
              {a.emailsOffText}{" "}
              <Link to="/preferences" className="font-medium underline">
                {t.nav.preferences}
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{a.connectTitle}</CardTitle>
          <CardDescription>{a.connectText}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PROVIDERS.map((provider) => (
            <Button key={provider} asChild variant="outline">
              <a href={connectUrl(provider)}>
                <PlugIcon /> {PROVIDER_LABELS[provider]}
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>

      {accounts.isPending && <Skeleton className="h-48" />}
      {accounts.isError && (
        <Alert variant="destructive">
          <AlertTitle>{a.loadError}</AlertTitle>
          <AlertDescription>{errorMessage(accounts.error)}</AlertDescription>
        </Alert>
      )}
      {accounts.data?.length === 0 && <p className="text-muted-foreground">{a.empty}</p>}
      <div className="grid gap-4">
        {accounts.data?.map((account) => <AccountCard key={account.id} account={account} />)}
      </div>
    </>
  );
}

function AccountCard({ account }: { account: AccountDto }) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const a = t.accounts;
  const onSuccess = (data: AccountDto[]) => {
    queryClient.setQueryData(queryKeys.accounts, data);
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  };

  const update = useMutation({
    mutationFn: (body: Parameters<typeof api.updateAccount>[1]) => api.updateAccount(account.id, body),
    onSuccess,
    onError: showError,
  });
  const calendars = useMutation({
    mutationFn: (selectedIds: string[]) => api.selectCalendars(account.id, selectedIds),
    onSuccess,
    onError: showError,
  });
  const sync = useMutation({
    mutationFn: () => api.syncAccount(account.id),
    onSuccess: (data) => {
      onSuccess(data);
      toast.success(a.calendarsRefreshed);
    },
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAccount(account.id),
    onSuccess: (data) => {
      onSuccess(data);
      toast.success(a.disconnected);
    },
    onError: showError,
  });

  const toggleCalendar = (calendarId: string, checked: boolean) => {
    const selected = new Set(account.calendars.filter((calendar) => calendar.selected).map((calendar) => calendar.id));
    if (checked) selected.add(calendarId);
    else selected.delete(calendarId);
    calendars.mutate([...selected]);
  };

  const invalid = account.status !== "valid";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {account.label}
          <Badge variant="secondary">{PROVIDER_LABELS[account.provider]}</Badge>
          {invalid && <Badge variant="destructive">{a.reauth}</Badge>}
        </CardTitle>
        <CardDescription>{account.email}</CardDescription>
        <CardAction className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => sync.mutate()}
            disabled={sync.isPending || invalid}
            aria-label={a.refreshCalendars}
            title={a.refreshCalendars}
          >
            {sync.isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={a.disconnect} title={a.disconnect}>
                <Trash2Icon />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{a.disconnectTitle(account.label)}</AlertDialogTitle>
                <AlertDialogDescription>{a.disconnectText(account.email)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{a.cancel}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
                  {a.disconnectConfirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {invalid && (
          <Alert variant="destructive">
            <AlertTitle>{a.expiredTitle}</AlertTitle>
            <AlertDescription>
              <p>{a.expiredText}</p>
              <Button asChild size="sm" className="mt-2">
                <a href={connectUrl(account.provider, account.id)}>{a.reconnect}</a>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`label-${account.id}`}>{a.displayName}</Label>
            <LabelInput
              key={account.label}
              id={`label-${account.id}`}
              initial={account.label}
              onSave={(label) => update.mutate({ label })}
            />
          </div>
          <div className="flex items-center gap-3 sm:pt-6">
            <Switch
              id={`email-${account.id}`}
              checked={account.includeEmail}
              disabled={update.isPending}
              onCheckedChange={(checked) => update.mutate({ includeEmail: checked })}
            />
            <Label htmlFor={`email-${account.id}`}>{a.emails}</Label>
          </div>
          <div className="flex items-center gap-3 sm:pt-6">
            <Switch
              id={`calendar-${account.id}`}
              checked={account.includeCalendar}
              disabled={update.isPending}
              onCheckedChange={(checked) => update.mutate({ includeCalendar: checked })}
            />
            <Label htmlFor={`calendar-${account.id}`}>{a.calendars}</Label>
          </div>
        </div>

        {account.includeEmail && (
          <div className="space-y-2 sm:max-w-sm">
            <Label htmlFor={`filter-${account.id}`}>{a.emailFilter}</Label>
            <select
              id={`filter-${account.id}`}
              value={account.emailFilter}
              disabled={update.isPending}
              onChange={(event) => update.mutate({ emailFilter: event.target.value as EmailFilter })}
              aria-describedby={`filter-help-${account.id}`}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            >
              {EMAIL_FILTERS.map((filter) => (
                <option key={filter} value={filter}>
                  {a.emailFilters[filter]}
                </option>
              ))}
            </select>
            <p id={`filter-help-${account.id}`} className="text-xs text-muted-foreground">
              {a.emailFilterHelp}
            </p>
          </div>
        )}

        {account.includeCalendar && (
          <>
            <Separator />
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{a.includedCalendars}</legend>
              {account.calendars.length === 0 && (
                <p className="text-sm text-muted-foreground">{a.noCalendars}</p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {account.calendars.map((calendar) => (
                  <div key={calendar.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cal-${calendar.id}`}
                      checked={calendar.selected}
                      disabled={calendars.isPending}
                      onCheckedChange={(checked) => toggleCalendar(calendar.id, checked === true)}
                    />
                    <span
                      className="size-2.5 shrink-0 rounded-full border"
                      style={{ backgroundColor: calendar.color ?? "transparent" }}
                      aria-hidden
                    />
                    <Label htmlFor={`cal-${calendar.id}`} className="font-normal">
                      {calendar.name}
                      {calendar.isPrimary && <span className="text-muted-foreground"> {a.primary}</span>}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {update.isPending ? t.common.saving : a.autosave}
      </CardFooter>
    </Card>
  );
}

function LabelInput({ id, initial, onSave }: { id: string; initial: string; onSave: (label: string) => void }) {
  const [label, setLabel] = useState(initial);
  const save = () => {
    const value = label.trim();
    if (!value || value === initial) setLabel(initial);
    else onSave(value);
  };
  return (
    <Input
      id={id}
      value={label}
      maxLength={40}
      onChange={(event) => setLabel(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
    />
  );
}
