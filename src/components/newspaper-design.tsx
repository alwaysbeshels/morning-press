import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, EyeIcon, Loader2Icon, XIcon } from "lucide-react";
import { COLOR_INTENSITIES, NEWSPAPER_PALETTES, NEWSPAPER_STYLES, type ColorIntensity, type NewspaperDesign, type NewspaperStyle } from "@shared/newspaper-design";
import type { Language } from "@shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/info-tooltip";
import { newspaperPreviewUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function StyleMiniature({ style, intensity, title }: { style: NewspaperStyle; intensity: ColorIntensity; title: string }) {
  const palette = NEWSPAPER_PALETTES[style];
  const expressive = intensity === "expressive";
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-md border bg-white p-3 shadow-sm" style={{ borderColor: palette.line }}>
      <div className="mb-1.5 flex justify-between border-b pb-1" style={{ borderColor: palette.line }}>
        <span className="h-0.5 w-9" style={{ background: palette.line }} />
        <span className="h-0.5 w-6" style={{ background: palette.line }} />
      </div>
      <div className={cn("truncate border-b-2 px-1 py-1 text-center text-[13px] leading-tight font-black", style === "nature" && "rounded")}
        style={{
          fontFamily: palette.headingFont, color: expressive ? "#ffffff" : palette.accent,
          background: expressive ? palette.accent : "#ffffff", borderColor: palette.secondary,
          letterSpacing: style === "retro" ? "0.08em" : style === "magazine" ? "-0.04em" : undefined,
          textAlign: ["nature", "magazine", "minimal"].includes(style) ? "left" : "center",
        }}>
        {title}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((column) => (
          <div key={column} className="space-y-1.5">
            <div className={cn("h-2 border-b-2", style === "nature" && "rounded-t")} style={{ borderColor: palette.secondary, background: expressive ? palette.wash : "#ffffff" }} />
            {[0, 1, 2, 3].map((line) => <div key={line} className={cn("h-0.5", line === 3 && "w-2/3")} style={{ background: palette.line }} />)}
            <div className="h-4 border-l-2" style={{ background: palette.wash, borderColor: palette.accent }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const PREVIEW_WIDTH = 816;
const PREVIEW_HEIGHT = 2208;

// Même seuil que le préfixe lg: de Tailwind : à partir de là, l'aperçu s'affiche à droite des choix.
const WIDE_QUERY = "(min-width: 64rem)";
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isWide = () => window.matchMedia(WIDE_QUERY).matches;

/**
 * Aperçu à double tampon : le rendu affiché reste visible pendant que le nouveau style
 * se prépare dans une iframe cachée, puis les deux sont échangées sans saut de hauteur.
 */
function DesignPreview({ id, url, caption, onRetry }: { id: string; url: string; caption: string; onRetry: () => void }) {
  const { t } = useI18n();
  const d = t.newspaperDesign;
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [shown, setShown] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [requested, setRequested] = useState(url);
  if (url !== requested) {
    setRequested(url);
    setFailed(null);
  }
  const error = failed === url;
  const loading = url !== shown && !error;
  const visible = error ? [] : [...new Set([shown, url])].filter((value): value is string => value !== null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => setScale(Math.min(1, element.clientWidth / PREVIEW_WIDTH));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (url === shown) return;
    const timeout = window.setTimeout(() => setFailed(url), 25_000);
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== frames.current.get(url)?.contentWindow) return;
      const data = event.data;
      if (typeof data !== "object" || data === null || !("type" in data) || data.type !== "morning-press-preview" || !("state" in data)) return;
      if (data.state === "ready") setShown(url);
      else if (data.state === "error") setFailed(url);
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [url, shown]);

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex min-h-0 min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-1">
          <h3 id={`${id}-title`} className="text-sm font-medium">{d.previewTitle}</h3>
          <InfoTooltip label={d.previewInfo} className="-my-1">{d.previewNote}</InfoTooltip>
        </div>
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {loading && shown ? <><Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />{d.previewUpdating}</> : caption}
        </p>
      </div>
      <div className="min-h-0 overflow-y-auto rounded-lg">
        <div ref={container} className="relative mx-auto w-full max-w-[816px] overflow-hidden rounded-lg border bg-[#f4f1ea]"
          style={{ height: error ? undefined : shown ? PREVIEW_HEIGHT * scale : 190 }}
          aria-busy={loading}>
          {loading && !shown && <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />{d.previewLoading}
          </div>}
          {error && <Alert variant="destructive" className="m-4 w-auto">
            <AlertDescription>
              <p>{d.previewError}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={onRetry}>{d.retry}</Button>
                {/* Session expirée : l'application installée n'a pas de bouton Recharger. */}
                <Button type="button" variant="outline" onClick={() => window.location.reload()}>{t.common.signInAgain}</Button>
              </div>
            </AlertDescription>
          </Alert>}
          {visible.map((src) => (
            <iframe key={src} src={src} title={d.previewTitle} sandbox="allow-scripts"
              ref={(element) => {
                if (!element) return;
                frames.current.set(src, element);
                return () => {
                  frames.current.delete(src);
                };
              }}
              tabIndex={src === shown ? undefined : -1}
              className="absolute top-0 left-0 border-0 transition-opacity duration-200" width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT}
              style={{
                transform: `scale(${scale})`, transformOrigin: "top left",
                visibility: src === shown ? "visible" : "hidden",
                opacity: src === shown && loading ? 0.45 : 1,
              }}
              onError={() => setFailed(src)} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function NewspaperDesignPicker({ design, language, onChange, footer }: {
  design: NewspaperDesign;
  language: Language;
  onChange: (design: NewspaperDesign) => void;
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();
  const d = t.newspaperDesign;
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const [showPreview, setShowPreview] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const url = newspaperPreviewUrl(design, language);
  return (
    // overflow-clip plutôt que hidden : garde les coins arrondis sans bloquer l'aperçu collant.
    <Card className="overflow-clip">
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]">
        <fieldset className="min-w-0 lg:col-start-1 lg:row-start-1">
          <legend className="mb-3 text-sm font-medium">{d.stylesLegend}</legend>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {NEWSPAPER_STYLES.map((style) => {
              const selected = design.newspaperStyle === style;
              const palette = NEWSPAPER_PALETTES[style];
              return <div key={style} className="min-w-0">
                <input type="radio" id={`newspaper-style-${style}`} name="newspaperStyle" className="peer sr-only"
                  checked={selected} onChange={() => onChange({ ...design, newspaperStyle: style })} />
                <label htmlFor={`newspaper-style-${style}`} className={cn(
                  "relative block h-full cursor-pointer space-y-2 rounded-xl border-2 p-2.5 transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 sm:p-3 lg:p-2.5",
                  selected ? "border-primary bg-primary/5" : "border-transparent bg-muted/40 hover:border-border",
                )}>
                  <StyleMiniature style={style} intensity={design.colorIntensity} title={d.miniature} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{d.styleNames[style]}</span>
                    {selected ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> :
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="size-2 rounded-full" style={{ background: palette.accent }} />
                        <span className="size-2 rounded-full" style={{ background: palette.secondary }} />
                      </span>}
                  </div>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{d.styleDescriptions[style]}</span>
                </label>
              </div>;
            })}
          </div>
        </fieldset>
        {/* Colonne de droite collante : l'intensité reste à côté des styles, au-dessus de l'aperçu. */}
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[calc(var(--app-header-height,0px)_+_1rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100svh_-_var(--app-header-height,0px)_-_2rem)] lg:self-start">
          <fieldset aria-labelledby="design-intensity-legend" className="min-w-0 shrink-0">
            <legend className="mb-3 flex items-center gap-1 text-sm font-medium">
              <span id="design-intensity-legend">{d.intensityLegend}</span>
              <InfoTooltip label={d.intensityInfo} className="-my-1">{d.baseHint}</InfoTooltip>
            </legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:gap-2">
              {COLOR_INTENSITIES.map((intensity) => <div key={intensity}>
                <input type="radio" id={`color-intensity-${intensity}`} name="colorIntensity" className="peer sr-only"
                  checked={design.colorIntensity === intensity} onChange={() => onChange({ ...design, colorIntensity: intensity })} />
                <label htmlFor={`color-intensity-${intensity}`} className={cn(
                  "block h-full cursor-pointer rounded-lg border px-4 py-3 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 lg:px-3 lg:py-2",
                  design.colorIntensity === intensity ? "border-primary bg-primary/5" : "border-input hover:bg-muted",
                )}>
                  <span className="block text-sm font-medium">{d.intensities[intensity]}</span>
                  <span className="mt-1 block text-xs text-muted-foreground lg:mt-0.5">{d.intensityDescriptions[intensity]}</span>
                </label>
              </div>)}
            </div>
          </fieldset>
          {!wide && <Button type="button" variant="outline" className="self-start" onClick={() => setShowPreview((value) => !value)}
            aria-expanded={showPreview} aria-controls="newspaper-style-preview">
            {showPreview ? <XIcon /> : <EyeIcon />}{showPreview ? d.previewClose : d.previewOpen}
          </Button>}
          {(wide || showPreview) && <DesignPreview key={attempt} id="newspaper-style-preview" url={url}
            caption={`${d.styleNames[design.newspaperStyle]} · ${d.intensities[design.colorIntensity]}`}
            onRetry={() => setAttempt((value) => value + 1)} />}
        </div>
        <p className="max-w-lg text-xs text-muted-foreground lg:col-start-1 lg:row-start-2">{d.saveHint}</p>
      </CardContent>
      {footer}
    </Card>
  );
}
