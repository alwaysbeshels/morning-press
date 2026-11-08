import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { MAX_NEWS_TOPICS, MAX_WATCHLIST, type Stock, type StockCategory } from "@shared/types";
import { StockBoard } from "@/components/stock-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, queryKeys } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";

export function TopicList({ topics, onChange }: { topics: string[]; onChange: (topics: string[]) => void }) {
  const { t } = useI18n();
  const p = t.preferences;
  const [draft, setDraft] = useState("");
  const topic = draft.trim();
  const duplicate = topics.some((item) => item.toLowerCase() === topic.toLowerCase());
  const full = topics.length >= MAX_NEWS_TOPICS;
  const add = () => {
    if (!topic || duplicate || full) return;
    onChange([...topics, topic]);
    setDraft("");
  };
  return (
    <div className="space-y-2 pt-2">
      <Label htmlFor="topic-input">{p.topics} ({topics.length}/{MAX_NEWS_TOPICS})</Label>
      <p id="topics-help" className="text-sm text-muted-foreground">{p.topicsHelp}</p>
      <div className="flex gap-2">
        <Input id="topic-input" value={draft} maxLength={80} disabled={full}
          aria-describedby="topics-help" aria-invalid={duplicate}
          placeholder={p.topicPlaceholder} onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); add(); }
          }} />
        <Button type="button" disabled={!topic || duplicate || full} onClick={add}>{p.addItem}</Button>
      </div>
      {duplicate && <p role="status" className="text-sm text-muted-foreground">{p.duplicateTopic}</p>}
      <ul className="flex flex-wrap gap-2">
        {topics.map((item, index) => (
          <li key={`${index}-${item}`} className="flex max-w-full items-center gap-1 rounded-md border py-1 pl-3 pr-1 text-sm">
            <span className="min-w-0 break-words">{item}</span>
            <Button type="button" size="icon-sm" variant="ghost" className="shrink-0"
              aria-label={p.removeItem(item)} onClick={() => onChange(topics.filter((_, i) => i !== index))}>
              <XIcon aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StockList({ stocks, categories, enabled, onChange }: {
  stocks: Stock[]; categories: StockCategory[]; enabled: boolean; onChange: (stocks: Stock[], categories: StockCategory[]) => void;
}) {
  const { t } = useI18n();
  const p = t.preferences;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const trimmed = query.trim();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), 350);
    return () => clearTimeout(timer);
  }, [trimmed]);
  const full = stocks.length >= MAX_WATCHLIST;
  const searching = enabled && !full && trimmed.length >= 2;
  const results = useQuery({
    queryKey: queryKeys.stocks(debounced),
    queryFn: ({ signal }) => api.searchStocks(debounced, signal),
    enabled: searching && debounced === trimmed,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return (
    <fieldset disabled={!enabled} className="space-y-3 disabled:opacity-60">
      <legend className="mb-2 text-sm font-medium">{p.watchlist} ({stocks.length}/{MAX_WATCHLIST})</legend>
      <StockBoard stocks={stocks} categories={categories} enabled={enabled} onChange={onChange} search={
        <div className="min-w-0 space-y-2">
          <Label htmlFor="stock-search" className="min-h-8">{p.stockSearch}</Label>
          <Input id="stock-search" value={query} disabled={full} maxLength={80}
            placeholder={p.stockPlaceholder} aria-describedby="stock-help" autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
          <p id="stock-help" className="text-sm text-muted-foreground">{full ? p.stockLimit : p.stockSearchHint}</p>
          {searching && (
            <div aria-live="polite">
              {debounced !== trimmed || results.isPending ? <p className="text-sm">{p.stockSearching}</p> :
                results.isError ? <div role="alert" className="space-y-2 text-sm text-destructive">
                  <p>{errorMessage(results.error)}</p>
                  <Button type="button" variant="outline" disabled={results.isFetching} onClick={() => void results.refetch()}>{p.stockRetry}</Button>
                </div> :
                  results.data.length === 0 ? <p className="text-sm text-muted-foreground">{p.stockNoResults}</p> :
                    <ul className="max-h-64 overflow-y-auto rounded-md border">
                      {results.data.map((stock) => (
                        <li key={stock.symbol}>
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted disabled:opacity-40"
                            disabled={stocks.some((item) => item.symbol === stock.symbol)}
                            onClick={() => { onChange([...stocks, { ...stock, categoryId: null }], categories); setQuery(""); }}>
                            <span className="font-semibold">{stock.symbol}</span>
                            <span className="ml-2 text-muted-foreground">{stock.exchange}</span>
                            <span className="block break-words">{stock.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>}
            </div>
          )}
        </div>
      } />
    </fieldset>
  );
}
