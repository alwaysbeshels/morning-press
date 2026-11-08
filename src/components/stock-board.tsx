import { useState, type ReactNode } from "react";
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin,
  useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { GripVerticalIcon, XIcon } from "lucide-react";
import { MAX_WATCHLIST, STOCK_COLORS, type Stock, type StockCategory } from "@shared/types";
import { categoryNameKey, groupStocks, moveStock, sortStocks, STOCK_PALETTES } from "@shared/stocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const stockId = (symbol: string) => `stock:${symbol}`;
const groupId = (id: string | null) => `category:${id ?? "general"}`;
const collisionDetection: CollisionDetection = (args) => {
  const targets = { ...args, droppableContainers: args.droppableContainers.filter((container) => container.id !== args.active.id) };
  const hits = pointerWithin(targets);
  const stocks = hits.filter((hit) => String(hit.id).startsWith("stock:"));
  return args.pointerCoordinates ? (stocks.length ? stocks : hits) : closestCenter(targets);
};

function StockCard({ stock, disabled, onRemove }: { stock: Stock; disabled: boolean; onRemove: () => void }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({
    id: stockId(stock.symbol), disabled,
  });
  return <li ref={setNodeRef} data-stock-symbol={stock.symbol}
    className={cn("flex min-w-0 items-center gap-2 rounded-md border bg-background p-2 text-sm", isDragging && "opacity-30")}>
    <Button ref={setActivatorNodeRef} type="button" size="icon-sm" variant="ghost" disabled={disabled}
      className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
      {...attributes} {...listeners} aria-label={t.preferences.stockDrag(stock.symbol)}>
      <GripVerticalIcon aria-hidden="true" />
    </Button>
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-1">
        <span className="min-w-0 truncate font-semibold" title={stock.symbol}>{stock.symbol}</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground" title={stock.exchange}>{stock.exchange}</span>
      </div>
      <span className="block truncate" title={stock.name}>{stock.name}</span>
    </div>
    <Button type="button" size="icon-sm" variant="ghost" className="shrink-0" disabled={disabled}
      aria-label={t.preferences.removeItem(stock.symbol)} onClick={onRemove}><XIcon aria-hidden="true" /></Button>
  </li>;
}

function StockGroup({ category, stocks, disabled, invalid, onCategory, onDelete, onRemove }: {
  category: StockCategory | null; stocks: Stock[]; disabled: boolean; invalid: boolean;
  onCategory: (category: StockCategory) => void; onDelete: () => void; onRemove: (symbol: string) => void;
}) {
  const { t } = useI18n();
  const p = t.preferences;
  const { setNodeRef, isOver } = useDroppable({ id: groupId(category?.id ?? null), disabled });
  const palette = category ? STOCK_PALETTES[category.color] : null;
  return <section ref={setNodeRef} aria-label={category?.name || p.stockGeneral} data-stock-category={category?.id ?? "general"}
    className={cn("min-w-0 space-y-3 rounded-lg border p-3", isOver && "ring-2 ring-ring")}
    style={palette ? { borderColor: palette.border, background: `color-mix(in srgb, ${palette.background} 30%, var(--card))` } : undefined}>
    <div className="flex flex-wrap items-center gap-2">
      {category ? <>
        <Input aria-label={p.stockCategoryName} value={category.name} maxLength={32} aria-invalid={invalid}
          className="min-w-28 flex-1 font-medium" onChange={(event) => onCategory({ ...category, name: event.target.value })} />
        <span aria-hidden="true" className="size-4 shrink-0 rounded-full border" style={{ background: palette!.background, borderColor: palette!.border }} />
        <select aria-label={p.stockCategoryColor} value={category.color}
          className="h-8 rounded-md border bg-background px-2 text-sm"
          onChange={(event) => {
            const color = STOCK_COLORS.find((value) => value === event.target.value);
            if (color) onCategory({ ...category, color });
          }}>
          {STOCK_COLORS.map((color) => <option key={color} value={color}>{p.stockColors[color]}</option>)}
        </select>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={p.stockDeleteCategory(category.name)} onClick={onDelete}>
          <XIcon aria-hidden="true" />
        </Button>
      </> : <h3 className="text-sm font-medium">{p.stockGeneral}</h3>}
      <span className="text-xs text-muted-foreground">{stocks.length}</span>
    </div>
    {invalid && <p role="alert" className="text-sm text-destructive">{p.stockCategoryInvalid}</p>}
    <SortableContext items={stocks.map((stock) => stockId(stock.symbol))} strategy={rectSortingStrategy}>
      <ul className="grid min-h-12 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stocks.map((stock) => <StockCard key={stock.symbol} stock={stock} disabled={disabled} onRemove={() => onRemove(stock.symbol)} />)}
      </ul>
    </SortableContext>
    {!stocks.length && <p className="text-xs text-muted-foreground">{p.stockDropHere}</p>}
  </section>;
}

export function StockBoard({ stocks, categories, enabled, onChange, search }: {
  stocks: Stock[]; categories: StockCategory[]; enabled: boolean;
  onChange: (stocks: Stock[], categories: StockCategory[]) => void;
  search: ReactNode;
}) {
  const { t } = useI18n();
  const p = t.preferences;
  const [name, setName] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const invalidName = (value: string, id?: string) => {
    const key = categoryNameKey(value);
    return !key || key === "general" || categories.some((category) => category.id !== id && categoryNameKey(category.name) === key);
  };
  const add = () => {
    if (!enabled || invalidName(name) || categories.length >= MAX_WATCHLIST) return;
    const color = STOCK_COLORS.find((value) => !categories.some((category) => category.color === value)) ?? STOCK_COLORS[categories.length % STOCK_COLORS.length];
    onChange(stocks, [...categories, { id: crypto.randomUUID(), name: name.trim(), color }]);
    setName("");
  };
  const destination = (id: string) => {
    const stock = stocks.find((item) => stockId(item.symbol) === id);
    if (stock) return { categoryId: stock.categoryId ?? null, stock };
    const category = categories.find((item) => groupId(item.id) === id);
    return category || id === groupId(null) ? { categoryId: category?.id ?? null, stock: undefined } : null;
  };
  const drop = ({ active: dragged, over }: DragEndEvent) => {
    setActive(null);
    if (!enabled || !over || dragged.id === over.id) return;
    const stock = stocks.find((item) => stockId(item.symbol) === dragged.id);
    const target = destination(String(over.id));
    if (!stock || !target) return;
    let before = target.stock?.symbol;
    if ((stock.categoryId ?? null) === target.categoryId && before) {
      const group = stocks.filter((item) => (item.categoryId ?? null) === target.categoryId);
      const from = group.findIndex((item) => item.symbol === stock.symbol);
      const to = group.findIndex((item) => item.symbol === before);
      if (from < to) before = group[to + 1]?.symbol;
    }
    onChange(moveStock(stocks, stock.symbol, target.categoryId, before), categories);
  };
  return <div className="space-y-3">
    <div className="grid items-start gap-4 md:grid-cols-2">
      {search}
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{p.stockCategories}</h3>
          <Button type="button" variant="outline" disabled={!enabled || stocks.length < 2}
            aria-label={p.stockSortHint} title={p.stockSortHint} onClick={() => onChange(sortStocks(stocks, categories), categories)}>{p.stockSort}</Button>
        </div>
        <div className="flex gap-2">
          <Input value={name} maxLength={32} placeholder={p.stockCategoryPlaceholder} aria-label={p.stockCategoryPlaceholder}
            aria-invalid={!!name.trim() && invalidName(name)} disabled={categories.length >= MAX_WATCHLIST}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); add(); } }} />
          <Button type="button" disabled={invalidName(name) || categories.length >= MAX_WATCHLIST} onClick={add}>{p.addItem}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{p.stockOrderHelp}</p>
        {name.trim() && invalidName(name) && <p role="status" className="text-sm text-destructive">{p.stockCategoryInvalid}</p>}
        {categories.length >= MAX_WATCHLIST && <p role="status" className="text-sm text-muted-foreground">{p.stockCategoryLimit}</p>}
      </div>
    </div>
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={({ active: dragged }) => setActive(String(dragged.id).slice(6))}
      onDragCancel={() => setActive(null)} onDragEnd={drop}
      accessibility={{
        screenReaderInstructions: { draggable: p.stockOrderHelp },
        announcements: {
          onDragStart: ({ active: dragged }) => p.stockDragStart(String(dragged.id).slice(6)),
          onDragOver: () => undefined,
          onDragEnd: ({ active: dragged, over }) => {
            const target = over ? destination(String(over.id)) : null;
            return target ? p.stockDragEnd(String(dragged.id).slice(6), categories.find((category) => category.id === target.categoryId)?.name ?? p.stockGeneral) : p.stockDragCancel;
          },
          onDragCancel: () => p.stockDragCancel,
        },
      }}>
      <div className="space-y-3">
        {groupStocks(stocks, categories).map(({ category, stocks: items }) =>
          <StockGroup key={category?.id ?? "general"} category={category} stocks={items} disabled={!enabled}
            invalid={!!category && invalidName(category.name, category.id)}
            onCategory={(next) => onChange(stocks, categories.map((item) => item.id === next.id ? next : item))}
            onDelete={() => onChange(stocks.map((stock) => stock.categoryId === category?.id ? { ...stock, categoryId: null } : stock), categories.filter((item) => item.id !== category?.id))}
            onRemove={(symbol) => onChange(stocks.filter((stock) => stock.symbol !== symbol), categories)} />)}
      </div>
      <DragOverlay>{active ? <div className="rounded-md border bg-background px-4 py-3 text-sm font-semibold shadow-lg">{active}</div> : null}</DragOverlay>
    </DndContext>
  </div>;
}
