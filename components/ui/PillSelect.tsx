// Path: src/components/ui/PillSelect.tsx
"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

type Align = "left" | "right";

export type PillSelectOption<T extends string> = {
  value: T;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
};

let _measureCanvas: HTMLCanvasElement | null = null;

function measureTextPx(text: string, font: string) {
  if (typeof document === "undefined") return 0;
  if (!_measureCanvas) _measureCanvas = document.createElement("canvas");
  const ctx = _measureCanvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(!!mq.matches);

    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  return isMobile;
}

export function PillSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  align = "right",
  extraWidthPx = 10,
  minWidthPx = 112,
}: {
  value: T;
  onChange: (next: T) => void;
  options: PillSelectOption<T>[];
  ariaLabel?: string;
  align?: Align;
  extraWidthPx?: number;
  minWidthPx?: number;
}) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [btnW, setBtnW] = useState<number>(minWidthPx);

  const current = useMemo(
    () => options.find((o) => o.value === value) ?? options[0],
    [options, value]
  );

  const safeBottomStyle = useMemo(
    () =>
      ({
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
      }) as React.CSSProperties,
    []
  );

  useEffect(() => {
    const idx = options.findIndex((o) => o.value === value);
    setActiveIdx(idx >= 0 ? idx : 0);
  }, [options, value]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (isMobile) return;

    const el = btnRef.current;
    const font = el ? window.getComputedStyle(el).font : "500 14px system-ui";

    const longest = options.reduce(
      (m, o) => (o.label.length > m.length ? o.label : m),
      options[0]?.label ?? ""
    );
    const textW = measureTextPx(longest, font);
    const paddingAndCaret = 16 + 28 + 16 + 18;
    const target = Math.ceil(textW + paddingAndCaret + extraWidthPx);

    setBtnW(Math.max(minWidthPx, target));
  }, [options, extraWidthPx, minWidthPx, isMobile]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || isMobile) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(options.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const pick = options[activeIdx];
        if (pick) onChange(pick.value);
        setOpen(false);
        btnRef.current?.focus();
      }
      if (e.key === "Tab") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeIdx, options, onChange, isMobile]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (wrapRef.current?.contains(t)) return;
      setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onScroll(e: Event) {
      const t = e.target as Node | null;
      if (t && menuRef.current?.contains(t)) return;
      setOpen(false);
    }

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (isMobile) {
    return (
      <>
        <button
          ref={btnRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={`pillselect-${id}`}
          onClick={() => setOpen(true)}
          className={[
            "relative inline-flex min-h-[44px] items-center justify-between rounded-full",
            "px-4 pr-10 text-[15px] font-medium select-none",
            "bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-sm",
            "hover:bg-[color:var(--pill-hover)] transition-all active:scale-[0.98]",
          ].join(" ")}
        >
          <span className="flex min-w-0 items-center gap-2 text-[color:var(--fg)]">
            {current?.icon ? <span className="shrink-0 text-[color:var(--fg)]">{current.icon}</span> : null}
            <span className="truncate">{current?.label ?? "Select"}</span>
          </span>

          <span className="pointer-events-none absolute right-3 grid h-6 w-6 place-items-center opacity-70 text-[color:var(--fg)]">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>

        {open && (
          <MobileSheet
            id={`pillselect-${id}`}
            title={ariaLabel ?? "Select"}
            value={value}
            options={options}
            onClose={() => setOpen(false)}
            onPick={(v) => {
              onChange(v);
              setOpen(false);
              btnRef.current?.focus();
            }}
            safeBottomStyle={safeBottomStyle}
          />
        )}
      </>
    );
  }

  const popW = Math.max(btnW, 220);

  return (
    <div ref={wrapRef} className={["relative inline-flex", open ? "z-[60]" : ""].join(" ")}>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`pillselect-${id}`}
        onClick={() => setOpen((v) => !v)}
        style={{ width: btnW }}
        className={[
          "relative inline-flex min-h-[44px] items-center justify-between rounded-full",
          "px-4 pr-10 text-sm font-medium select-none",
          "bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-sm",
          "hover:bg-[color:var(--pill-hover)] transition-all active:scale-[0.98]",
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2 text-[color:var(--fg)]">
          {current?.icon ? <span className="shrink-0 text-[color:var(--fg)]">{current.icon}</span> : null}
          <span className="truncate">{current?.label ?? "Select"}</span>
        </span>

        <span className="pointer-events-none absolute right-3 grid h-6 w-6 place-items-center opacity-70 text-[color:var(--fg)]">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[50]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={menuRef}
            id={`pillselect-${id}`}
            role="menu"
            className={[
              "absolute z-[61] mt-2 overflow-hidden rounded-2xl",
              "bg-[color:var(--surface-strong)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-pill)]",
              align === "right" ? "right-0" : "left-0",
            ].join(" ")}
            style={{ width: popW }}
          >
            <div className="p-1">
              {options.map((o, idx) => {
                const isActive = idx === activeIdx;
                const isSelected = o.value === value;

                return (
                  <button
                    key={o.value}
                    role="menuitemradio"
                    aria-checked={isSelected}
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      btnRef.current?.focus();
                    }}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left transition",
                      isSelected
                        ? "bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] font-semibold"
                        : isActive
                          ? "bg-[color:var(--pill)] text-[color:var(--fg)]"
                          : "bg-transparent text-[color:var(--fg)]",
                      !isSelected ? "hover:bg-[color:var(--pill)]" : "",
                      "active:scale-[0.99]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {o.icon ? <span className="mt-0.5 shrink-0 text-[color:var(--fg)]">{o.icon}</span> : null}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[color:var(--fg)]">{o.label}</div>
                          {o.subtitle ? (
                            <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                              {o.subtitle}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="shrink-0 text-[color:var(--fg)]" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MobileSheet<T extends string>({
  id,
  title,
  value,
  options,
  onClose,
  onPick,
  safeBottomStyle,
}: {
  id: string;
  title: string;
  value: T;
  options: PillSelectOption<T>[];
  onClose: () => void;
  onPick: (v: T) => void;
  safeBottomStyle: React.CSSProperties;
}) {
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    lastActiveRef.current =
      (typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null) ?? null;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehaviorY;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehaviorY = "contain";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehaviorY = prevOverscroll;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        lastActiveRef.current?.focus?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        id={id}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[color:var(--surface-strong)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-pill)]"
        style={safeBottomStyle}
      >
        <div className="mx-auto max-w-6xl px-5 py-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/15" />

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[color:var(--fg)]">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className={[
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full",
                "bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)]",
                "hover:bg-[color:var(--pill-hover)] active:scale-[0.98] transition",
              ].join(" ")}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            {options.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onPick(o.value)}
                  className={[
                    "w-full rounded-2xl px-4 py-3 text-left transition ring-1 ring-[color:var(--border)]",
                    isSelected
                      ? "bg-[color:var(--pill)] text-[color:var(--fg)]"
                      : "bg-[color:var(--pill)] text-[color:var(--fg)] hover:bg-[color:var(--pill-hover)]",
                    "active:scale-[0.99]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {o.icon ? <span className="mt-0.5 shrink-0 text-[color:var(--fg)]">{o.icon}</span> : null}
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold text-[color:var(--fg)]">{o.label}</div>
                        {o.subtitle ? (
                          <div className="mt-0.5 text-xs text-[color:var(--muted)]">{o.subtitle}</div>
                        ) : null}
                      </div>
                    </div>
                    {isSelected ? <span className="text-lg text-[color:var(--fg)]">✓</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}