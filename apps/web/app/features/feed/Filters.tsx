// Feed filters: the channel and category row, and search.
import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import { CATEGORY_KEYS, CATEGORY_LABELS, CHANNEL_LABELS, type CategoryKey, type ChannelKey } from "@aihot/contracts/taxonomy";
import { IconClose, IconSearch } from "../../components/icons";
import { PillTabs } from "../../components/ui/Tabs";

/** Same page with some query parameters changed (paging state dropped). */
export function hrefWith(base: string, params: URLSearchParams, patch: Record<string, string | null>) {
  const sp = new URLSearchParams(params);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  sp.delete("page");
  sp.delete("cursor");
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/** Filtro compartilhado entre seleção e notícias: todas, fonte direta e categorias. Fonte direta limpa categoria e vice-versa. Links antigos por canal ainda filtram; a linha exibe Todas. */
export function CategoryTabs({ base, category, channel = "all", layoutId, size = "md", className = "" }: { base: string; category: CategoryKey | null; channel?: ChannelKey; layoutId: string; size?: "md" | "sm"; className?: string }) {
  const [params] = useSearchParams();
  const items = [
    { key: "all", label: "Todos", to: hrefWith(base, params, { category: null, channel: null }) },
    { key: "firstParty", label: CHANNEL_LABELS.firstParty, to: hrefWith(base, params, { category: null, channel: "firstParty" }) },
    ...CATEGORY_KEYS.map((k) => ({ key: k, label: CATEGORY_LABELS[k], to: hrefWith(base, params, { category: k, channel: null }) })),
  ];
  const active = channel === "firstParty" ? "firstParty" : (category ?? "all");
  return <PillTabs items={items} active={active} layoutId={layoutId} label="Filtrar" size={size} className={className} />;
}

function useSlashFocus(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref]);
}

/** Busca GET /all?q=. No computador, integra a faixa cinza dos filtros, alinhada às abas e com atalho /. No celular, ocupa largura total com botão Buscar. */
export function SearchField({ action = "/all", defaultValue = "", keep = {}, variant = "track", autoFocus = false }: { action?: string; defaultValue?: string; keep?: Record<string, string | null>; variant?: "track" | "bar"; autoFocus?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const navigation = useNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setValue(defaultValue), [defaultValue]);
  useSlashFocus(inputRef);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  const searching = navigation.state === "loading" && navigation.location?.pathname === action && !!new URLSearchParams(navigation.location.search).get("q");
  const hidden = Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null));

  if (variant === "bar") {
    return (
      <Form method="get" action={action} role="search" className="flex gap-2">
        {hidden}
        <label className="relative flex-1">
          <span className="sr-only">Buscar título, resumo e texto</span>
          <IconSearch size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-4" />
          <input
            ref={inputRef}
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Buscar título e resumo…"
            maxLength={200}
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-full border border-line-strong bg-surface pl-10 pr-9 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-4 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          {value && (
            <button type="button" aria-label="Limpar" onClick={() => { setValue(""); inputRef.current?.focus(); }} className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-4">
              <IconClose size={15} />
            </button>
          )}
        </label>
        <button type="submit" className={`h-11 shrink-0 rounded-full bg-accent px-5 text-[14.5px] font-semibold text-accent-contrast transition-[background-color,transform] active:scale-[0.98] ${searching ? "opacity-60" : ""}`}>
          Buscar
        </button>
      </Form>
    );
  }

  return (
    <Form method="get" action={action} role="search" className="group relative w-full shrink-0 lg:w-60">
      {hidden}
      <label htmlFor="site-search" className="sr-only">
        Buscar título, resumo e texto
      </label>
      <IconSearch size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searching ? "text-accent" : "text-ink-4 group-focus-within:text-ink-3"}`} />
      <input
        ref={inputRef}
        id="site-search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar título e resumo…"
        maxLength={200}
        autoComplete="off"
        className="h-[42px] w-full rounded-full bg-bg-sunk pl-10 pr-10 text-[14px] text-ink outline-none ring-1 ring-inset ring-line-soft transition-[background-color,box-shadow] placeholder:text-ink-4 hover:ring-line-strong focus:bg-surface focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:ring-accent dark:bg-bg-muted/60 dark:focus:bg-surface"
      />
      {value ? (
        <button
          type="button"
          aria-label="Limpar"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-4 transition-colors hover:bg-bg-sunk hover:text-ink"
        >
          <IconClose size={13} />
        </button>
      ) : (
        <kbd className="mono pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-mark border border-line-strong bg-surface px-1.5 text-[10.5px] leading-4 text-ink-4 lg:block">/</kbd>
      )}
    </Form>
  );
}

/** No início móvel, ícone de busca dos filtros abre busca nas notícias gerais. */
export function SearchIconLink() {
  return (
    <Link to="/all?search=1" aria-label="Buscar" className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-bg-sunk hover:text-ink">
      <IconSearch size={19} />
    </Link>
  );
}
