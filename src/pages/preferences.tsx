import { useMemo, useState } from "react";
import { Link, useBlocker, type ShouldBlockFn } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FOOD_RESTRICTIONS, GAME_KINDS, isProteinAllowed, LANGUAGES, MEAL_TYPES, NEWS_SECTIONS, PROTEIN_CHOICES, type CookingPreferences, type GameKind, type MeDto, type PageCount, type Preferences, type ScheduleSettings, type SettingsDto } from "@shared/types";
import { settingsUpdateSchema, validationMessage, type SettingsUpdate } from "@shared/schemas";
import { CircleDotIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout";
import { NewspaperDesignPicker } from "@/components/newspaper-design";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, queryKeys } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { messages, useI18n } from "@/lib/i18n";
import {
  applyEdits,
  describeChanges,
  FORM_SECTIONS,
  pickSection,
  settingsPayload,
  toFormValues,
  withoutSaved,
  type FormEdits,
  type FormSection,
  type FormValues,
} from "@/lib/preferences-form";
import { cn } from "@/lib/utils";

const TIME_ZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

/** Bloque seulement les sorties de la page, pas les changements de paramètres d'URL. */
const leavesPage: ShouldBlockFn = ({ current, next }) => current.pathname !== next.pathname;

export function PreferencesPage() {
  const settings = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const { t } = useI18n();
  const p = t.preferences;

  return (
    <>
      <PageHeader title={p.title} description={p.description} />
      {settings.isPending && <Skeleton className="h-96" />}
      {settings.isError && (
        <Alert variant="destructive">
          <AlertTitle>{p.loadError}</AlertTitle>
          <AlertDescription>{errorMessage(settings.error)}</AlertDescription>
        </Alert>
      )}
      {settings.data && <PreferencesForm saved={settings.data} />}
    </>
  );
}

interface SegmentedProps<T extends string | number> {
  name: string;
  legend: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  describedBy?: string;
}

/** Choix exclusif présenté en boutons accolés (boutons radio natifs, donc accessibles au clavier). */
function Segmented<T extends string | number>({ name, legend, value, options, onChange, describedBy }: SegmentedProps<T>) {
  return (
    <fieldset className="space-y-2" aria-describedby={describedBy}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="inline-flex rounded-lg border border-input p-0.5">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const checked = option.value === value;
          return (
            <div key={id}>
              <input
                type="radio"
                id={id}
                name={name}
                className="peer sr-only"
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              <label
                htmlFor={id}
                className={cn(
                  "block cursor-pointer rounded-md px-3 py-1 text-sm transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                  checked ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

interface SaveRequest {
  payload: SettingsUpdate;
  sent: FormEdits;
  scope: FormSection | "all";
}

function SectionFooter({ title, dirty, busy, saving, onSave }: { title: string; dirty: boolean; busy: boolean; saving: boolean; onSave: () => void }) {
  const { t } = useI18n();
  const p = t.preferences;
  return (
    <CardFooter className="flex-wrap justify-end gap-x-3 gap-y-2">
      <div role="status" className="mr-auto">
        {dirty && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <CircleDotIcon className="size-3.5" aria-hidden="true" />
            {p.sectionUnsaved}
          </p>
        )}
      </div>
      <Button type="button" size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || busy} onClick={onSave}
        aria-label={p.saveSection(title)}>
        {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
        {t.common.save}
      </Button>
    </CardFooter>
  );
}

function PreferencesForm({ saved }: { saved: SettingsDto }) {
  const queryClient = useQueryClient();
  const { t, language } = useI18n();
  const p = t.preferences;
  // Copie locale : la réponse d'enregistrement et le retrait des modifications s'appliquent dans le même rendu.
  const [current, setCurrent] = useState(saved);
  const [received, setReceived] = useState(saved);
  if (saved !== received) {
    setReceived(saved);
    setCurrent(saved);
  }
  const base = useMemo(() => toFormValues(current), [current]);
  const [edits, setEdits] = useState<FormEdits>({});
  const values = useMemo(() => applyEdits(base, edits), [base, edits]);
  const changes = useMemo(() => describeChanges(base, values, t), [base, values, t]);
  const dirty = new Set(changes.map((change) => change.section));
  const { schedule, prefs, topics, keywords, ignored } = values;
  const cooking = prefs.cooking;

  // Chaque modification est rangée dans sa section pour pouvoir l'enregistrer séparément.
  const edit = (section: FormSection, update: (draft: FormValues) => FormValues) =>
    setEdits((pending) => ({ ...pending, [section]: pickSection(update(applyEdits(base, pending)), section) }));
  const updatePrefs = (section: FormSection, patch: (draft: Preferences) => Partial<Preferences>) =>
    edit(section, (draft) => ({ ...draft, prefs: { ...draft.prefs, ...patch(draft.prefs) } }));
  const setPrefs = (section: FormSection, patch: Partial<Preferences>) => updatePrefs(section, () => patch);
  const updateSchedule = (patch: (draft: ScheduleSettings) => Partial<ScheduleSettings>) =>
    edit("schedule", (draft) => ({ ...draft, schedule: { ...draft.schedule, ...patch(draft.schedule) } }));
  const setText = (section: FormSection, field: "topics" | "keywords" | "ignored", value: string) =>
    edit(section, (draft) => ({ ...draft, [field]: value }));
  const updateCooking = (patch: Partial<CookingPreferences>) =>
    updatePrefs("cooking", (draft) => ({ cooking: { ...draft.cooking, ...patch } }));

  const save = useMutation({
    mutationFn: ({ payload }: SaveRequest) => api.updateSettings(payload),
    onSuccess: (data, { sent }) => {
      queryClient.setQueryData(queryKeys.settings, data);
      queryClient.setQueryData<MeDto>(queryKeys.me, (me) => (me ? { ...me, language: data.preferences.language } : me));
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      setCurrent(data);
      setEdits((pending) => withoutSaved(pending, sent));
      // La langue du journal ne change pas celle du site (bouton FR / EN du menu).
      toast.success(messages().preferences.saved);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  /** Enregistre une section (ou tout) par-dessus les valeurs déjà enregistrées. */
  const saveSections = async (scope: FormSection | "all"): Promise<boolean> => {
    const sections: readonly FormSection[] = scope === "all" ? FORM_SECTIONS : [scope];
    const sent: FormEdits = {};
    for (const section of sections) if (edits[section]) sent[section] = edits[section];
    const parsed = settingsUpdateSchema.safeParse(settingsPayload(applyEdits(base, sent)));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue ? validationMessage(issue, language) : p.invalidValue;
      toast.error(`${issue?.path.join(" › ") || p.form}${t.colon}${message}`);
      return false;
    }
    try {
      await save.mutateAsync({ payload: parsed.data, sent, scope });
      return true;
    } catch {
      // Erreur déjà affichée par onError.
      return false;
    }
  };

  const blocker = useBlocker({ shouldBlockFn: leavesPage, disabled: dirty.size === 0, withResolver: true });
  const discardAndLeave = () => {
    const proceed = blocker.proceed;
    setEdits({});
    proceed?.();
  };
  const saveAndLeave = async () => {
    const proceed = blocker.proceed;
    if (await saveSections("all")) proceed?.();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (dirty.size > 0 && !save.isPending) void saveSections("all");
  };

  const footer = (section: FormSection, title: string) => (
    <SectionFooter
      title={title}
      dirty={dirty.has(section)}
      busy={save.isPending}
      saving={save.isPending && save.variables?.scope === section}
      onSave={() => void saveSections(section)}
    />
  );

  const toggleDay = (day: number, checked: boolean) =>
    updateSchedule((draft) => ({
      days: checked ? [...new Set([...draft.days, day])] : draft.days.filter((value) => value !== day),
    }));

  const toggleGame = (kind: GameKind, checked: boolean) =>
    updatePrefs("game", (draft) => ({
      gameKinds: checked ? GAME_KINDS.filter((k) => k === kind || draft.gameKinds.includes(k)) : draft.gameKinds.filter((k) => k !== kind),
    }));

  const numberField = (key: "maxEvents" | "maxPriorities" | "maxEmails" | "maxNews", min: number, max: number) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{p[key]}</Label>
      <Input
        id={key}
        type="number"
        min={min}
        max={max}
        value={prefs[key]}
        onChange={(event) => edit("limits", (draft) => ({ ...draft, prefs: { ...draft.prefs, [key]: Number(event.target.value) } }))}
      />
    </div>
  );

  const twoPages = prefs.pages === 2;

  return (
    <>
      <form onSubmit={submit} className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{p.layoutTitle}</CardTitle>
            <CardDescription>{p.layoutDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-10 gap-y-5">
            <Segmented
              name="language"
              legend={p.language}
              value={prefs.language}
              options={LANGUAGES.map((value) => ({ value, label: t.languageNames[value] }))}
              onChange={(value) => setPrefs("layout", { language: value })}
            />
            <div className="space-y-2">
              <Segmented<PageCount>
                name="pages"
                legend={p.pages}
                value={prefs.pages}
                options={[
                  { value: 1, label: p.onePage },
                  { value: 2, label: p.twoPages },
                ]}
                onChange={(value) => setPrefs("layout", { pages: value })}
                describedBy="pages-help"
              />
              <p id="pages-help" className="max-w-md text-sm text-muted-foreground">
                {p.pagesHelp(prefs.pages)}
              </p>
            </div>
          </CardContent>
          {footer("layout", p.layoutTitle)}
        </Card>

        <NewspaperDesignPicker
          design={{ newspaperStyle: prefs.newspaperStyle, colorIntensity: prefs.colorIntensity }}
          language={prefs.language}
          onChange={(design) => setPrefs("design", design)}
          footer={footer("design", t.newspaperDesign.title)}
        />

        <Card>
          <CardHeader>
            <CardTitle>{p.scheduleTitle}</CardTitle>
            <CardDescription>
              {p.nextEdition(current.schedule.enabled && current.nextRunAt ? formatDateTime(current.nextRunAt, language) : null)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <Switch
                id="enabled"
                checked={schedule.enabled}
                onCheckedChange={(enabled) => updateSchedule(() => ({ enabled }))}
              />
              <Label htmlFor="enabled">{p.autoGenerate}</Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="time">{p.time}</Label>
                <Input id="time" type="time" value={schedule.time} onChange={(event) => updateSchedule(() => ({ time: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">{p.timezone}</Label>
                <Input
                  id="timezone"
                  list="timezones"
                  value={schedule.timezone}
                  onChange={(event) => updateSchedule(() => ({ timezone: event.target.value }))}
                />
                <datalist id="timezones">
                  {TIME_ZONES.map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
              </div>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{p.days}</legend>
              <div className="flex flex-wrap gap-4">
                {t.days.map((day) => (
                  <div key={day.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={schedule.days.includes(day.value)}
                      onCheckedChange={(checked) => toggleDay(day.value, checked === true)}
                    />
                    <Label htmlFor={`day-${day.value}`} className="font-normal" title={day.long}>
                      {day.short}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
          </CardContent>
          {footer("schedule", p.scheduleTitle)}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.placeTitle}</CardTitle>
            <CardDescription>{p.placeDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">{p.city}</Label>
              <Input id="city" value={prefs.city} onChange={(event) => setPrefs("place", { city: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">{p.region}</Label>
              <Input id="region" value={prefs.region} onChange={(event) => setPrefs("place", { region: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="latitude">{p.latitude}</Label>
              <Input
                id="latitude"
                type="number"
                step="0.0001"
                value={prefs.latitude}
                onChange={(event) => setPrefs("place", { latitude: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">{p.longitude}</Label>
              <Input
                id="longitude"
                type="number"
                step="0.0001"
                value={prefs.longitude}
                onChange={(event) => setPrefs("place", { longitude: Number(event.target.value) })}
              />
            </div>
          </CardContent>
          {footer("place", p.placeTitle)}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.newsTitle}</CardTitle>
            <CardDescription>{p.newsDescription(prefs.pages)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <Switch
                id="news"
                checked={prefs.newsEnabled}
                onCheckedChange={(newsEnabled) => setPrefs("news", { newsEnabled })}
              />
              <Label htmlFor="news">{p.newsEnabled}</Label>
            </div>
            <fieldset disabled={!prefs.newsEnabled} className="space-y-3 disabled:opacity-60" aria-describedby="sections-help">
              {NEWS_SECTIONS.map((key) => {
                const section = prefs.newsSections[key];
                const setSection = (patch: Partial<typeof section>) =>
                  updatePrefs("news", (draft) => ({
                    newsSections: { ...draft.newsSections, [key]: { ...draft.newsSections[key], ...patch } },
                  }));
                return (
                  <div key={key} className="grid items-center gap-2 sm:grid-cols-[11rem_1fr]">
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`section-${key}`}
                        checked={section.enabled}
                        onCheckedChange={(enabled) => setSection({ enabled })}
                      />
                      <Label htmlFor={`section-${key}`}>{p.sections[key]}</Label>
                    </div>
                    <Input
                      aria-label={p.sections[key]}
                      placeholder={p.sectionPlaceholders[key]}
                      maxLength={80}
                      disabled={!section.enabled}
                      value={section.query}
                      onChange={(event) => setSection({ query: event.target.value })}
                    />
                  </div>
                );
              })}
              <p id="sections-help" className="text-sm text-muted-foreground">
                {p.sectionsHelp}
              </p>
              <div className="space-y-2 pt-2">
                <Label htmlFor="topics">{p.topics}</Label>
                <Textarea id="topics" rows={3} value={topics} onChange={(event) => setText("news", "topics", event.target.value)} />
              </div>
            </fieldset>
          </CardContent>
          {footer("news", p.newsTitle)}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.emailsTitle}</CardTitle>
            <CardDescription>{p.emailsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Switch
                  id="emails"
                  checked={prefs.emailsEnabled}
                  onCheckedChange={(emailsEnabled) => setPrefs("emails", { emailsEnabled })}
                />
                <Label htmlFor="emails">{p.emailsEnabled}</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {p.emailsFilterHint}{" "}
                <Link to="/comptes" className="font-medium underline">
                  {t.nav.accounts}
                </Link>
                .
              </p>
            </div>
            <fieldset disabled={!prefs.emailsEnabled} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="keywords">{p.keywords}</Label>
                <Textarea
                  id="keywords"
                  rows={5}
                  placeholder={p.keywordsPlaceholder}
                  value={keywords}
                  onChange={(event) => setText("emails", "keywords", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ignored">{p.ignored}</Label>
                <Textarea
                  id="ignored"
                  rows={5}
                  placeholder={p.ignoredPlaceholder}
                  value={ignored}
                  onChange={(event) => setText("emails", "ignored", event.target.value)}
                />
              </div>
            </fieldset>
          </CardContent>
          {footer("emails", p.emailsTitle)}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.gameTitle}</CardTitle>
            <CardDescription>{p.gameDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!twoPages && (
              <Alert>
                <AlertDescription>
                  <p>
                    {p.gameOnlyTwoPages}{" "}
                    <button type="button" className="font-medium underline" onClick={() => setPrefs("layout", { pages: 2 })}>
                      {p.switchToTwoPages}
                    </button>
                  </p>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center gap-3">
              <Switch
                id="game"
                checked={prefs.gameEnabled}
                onCheckedChange={(gameEnabled) => setPrefs("game", { gameEnabled })}
              />
              <Label htmlFor="game">{p.gameEnabled}</Label>
            </div>
            <fieldset disabled={!prefs.gameEnabled} className="disabled:opacity-60">
              <legend className="mb-2 text-sm font-medium">{p.gameKinds}</legend>
              <div className="flex flex-wrap gap-5">
                {GAME_KINDS.map((kind) => (
                  <div key={kind} className="flex items-center gap-2">
                    <Checkbox
                      id={`game-${kind}`}
                      checked={prefs.gameKinds.includes(kind)}
                      disabled={!prefs.gameEnabled}
                      onCheckedChange={(checked) => toggleGame(kind, checked === true)}
                    />
                    <Label htmlFor={`game-${kind}`} className="font-normal">
                      {t.games[kind]}
                    </Label>
                  </div>
                ))}
              </div>
              {twoPages && prefs.gameEnabled && prefs.gameKinds.length === 0 && (
                <p className="mt-2 text-sm text-destructive">{p.chooseGame}</p>
              )}
            </fieldset>
          </CardContent>
          {footer("game", p.gameTitle)}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.dailyTitle}</CardTitle>
            <CardDescription>{p.dailyDescription}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.cookingTitle}</CardTitle>
            <CardDescription>{p.cookingDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <Switch id="cooking" checked={cooking.enabled} onCheckedChange={(enabled) => updateCooking({ enabled })} />
              <Label htmlFor="cooking">{p.cookingEnabled}</Label>
            </div>
            <fieldset disabled={!cooking.enabled} className="space-y-5 disabled:opacity-60">
              <div className="flex flex-wrap gap-5">
                {(["vegetarian", "vegan"] as const).map((diet) => (
                  <div key={diet} className="flex items-center gap-2">
                    <Checkbox id={`diet-${diet}`} checked={cooking[diet]} disabled={!cooking.enabled}
                      onCheckedChange={(checked) => updateCooking({ [diet]: checked === true })} />
                    <Label htmlFor={`diet-${diet}`}>{p[diet]}</Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{p.dietHelp}</p>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-medium">{p.meals}</legend>
                <div className="flex items-center gap-2">
                  <Checkbox id="all-meals" disabled={!cooking.enabled}
                    checked={cooking.meals.length === MEAL_TYPES.length ? true : cooking.meals.length ? "indeterminate" : false}
                    onCheckedChange={(checked) => updateCooking({ meals: checked === true ? [...MEAL_TYPES] : [] })} />
                  <Label htmlFor="all-meals">{p.allMeals}</Label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {MEAL_TYPES.map((meal) => (
                    <div key={meal} className="flex items-center gap-2">
                      <Checkbox id={`meal-${meal}`} checked={cooking.meals.includes(meal)} disabled={!cooking.enabled}
                        onCheckedChange={(checked) => updateCooking({ meals: checked === true ? [...cooking.meals, meal] : cooking.meals.filter((value) => value !== meal) })} />
                      <Label htmlFor={`meal-${meal}`} className="font-normal">{p.mealNames[meal]}</Label>
                    </div>
                  ))}
                </div>
                {cooking.enabled && !cooking.meals.length && <p className="text-sm text-destructive">{p.chooseMeal}</p>}
              </fieldset>
              <fieldset>
                <legend className="mb-3 text-sm font-medium">{p.proteins}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {PROTEIN_CHOICES.map((protein) => (
                    <div key={protein} className="flex items-center gap-2">
                      <Checkbox id={`protein-${protein}`} checked={isProteinAllowed(cooking, protein) && cooking.proteins.includes(protein)}
                        disabled={!cooking.enabled || !isProteinAllowed(cooking, protein)}
                        onCheckedChange={(checked) => updateCooking({ proteins: checked === true ? [...cooking.proteins, protein] : cooking.proteins.filter((value) => value !== protein) })} />
                      <Label htmlFor={`protein-${protein}`} className="font-normal">{p.proteinNames[protein]}</Label>
                    </div>
                  ))}
                </div>
                {cooking.enabled && !cooking.proteins.some((protein) => isProteinAllowed(cooking, protein)) && <p className="mt-2 text-sm text-destructive">{p.chooseProtein}</p>}
              </fieldset>
              <fieldset>
                <legend className="mb-3 text-sm font-medium">{p.restrictions}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {FOOD_RESTRICTIONS.map((restriction) => (
                    <div key={restriction} className="flex items-center gap-2">
                      <Checkbox id={`restriction-${restriction}`} checked={cooking.restrictions.includes(restriction)} disabled={!cooking.enabled}
                        onCheckedChange={(checked) => updateCooking({ restrictions: checked === true ? [...cooking.restrictions, restriction] : cooking.restrictions.filter((value) => value !== restriction) })} />
                      <Label htmlFor={`restriction-${restriction}`} className="font-normal">{p.restrictionNames[restriction]}</Label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <p className="text-sm text-muted-foreground">{p.recipeHelp}</p>
              <div className="flex items-center gap-2">
                <Checkbox id="recipe-photo" checked={cooking.showPhoto} disabled={!cooking.enabled}
                  onCheckedChange={(checked) => updateCooking({ showPhoto: checked === true })} />
                <Label htmlFor="recipe-photo" className="font-normal">{p.photoEnabled}</Label>
              </div>
              <p className="text-sm text-muted-foreground">{p.photoHelp}</p>
            </fieldset>
          </CardContent>
          {footer("cooking", p.cookingTitle)}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.exerciseTitle}</CardTitle>
            <CardDescription>{p.exerciseDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch id="exercise" checked={prefs.exerciseEnabled} onCheckedChange={(exerciseEnabled) => setPrefs("exercise", { exerciseEnabled })} />
              <Label htmlFor="exercise">{p.exerciseEnabled}</Label>
            </div>
            <p className="text-sm text-muted-foreground">{p.exerciseHelp}</p>
          </CardContent>
          {footer("exercise", p.exerciseTitle)}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p.limitsTitle}</CardTitle>
            <CardDescription>{p.limitsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            {numberField("maxEvents", 1, 20)}
            {numberField("maxPriorities", 1, 7)}
            {numberField("maxEmails", 1, 8)}
            {numberField("maxNews", 0, 5)}
          </CardContent>
          {footer("limits", p.limitsTitle)}
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <p role="status" className="text-sm text-muted-foreground">
            {dirty.size > 0 && p.unsavedSections(dirty.size)}
          </p>
          <Button type="submit" disabled={dirty.size === 0 || save.isPending}>
            {save.isPending && save.variables?.scope === "all" ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {p.saveAll}
          </Button>
        </div>
      </form>
      <UnsavedChangesDialog
        open={blocker.status === "blocked"}
        changes={changes}
        saving={save.isPending}
        onStay={() => blocker.reset?.()}
        onDiscard={discardAndLeave}
        onSave={() => void saveAndLeave()}
      />
    </>
  );
}
