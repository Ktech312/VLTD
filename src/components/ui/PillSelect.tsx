// Path: src/components/ui/PillSelect.tsx
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Align = "left" | "right";

export type PillSelectOption<T extends string> = {
  value: T;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
};

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="m5.5 10.25 3 3 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M6 6l8 8M14 6l-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Use pointer:coarse (touch devices) instead of viewport width — works correctly
    // on large phones, iPads, and any touch-primary device regardless of screen size
    const mq = window.matchMedia("(pointer: coarse)");
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
  showSelectedSubtitle = false,
  labelPrefix = "",
  compact = false,
}: {
  value: T;
  onChange: (next: T) => void;
  options: PillSelectOption<T>[];
  ariaLabel?: string;
  align?: Align;
  extraWidthPx?: number;
  minWidthPx?: number;
  showSelectedSubtitle?: boolean;
  labelPrefix?: string;
  compact?: boolean;
}) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null);

  const selectedIdx = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value]
  );

  const current = useMemo(
    () => (selectedIdx >= 0 ? options[selectedIdx] : options[0]),
    [options, selectedIdx]
  );

  const btnW = useMemo(() => {
    const longestLabelLength = options.reduce(
      (maxLength, option) => Math.max(maxLength, option.label.length),
      0
    );
    const longestSubtitleLength = showSelectedSubtitle
      ? options.reduce(
          (maxLength, option) => Math.max(maxLength, option.subtitle?.length ?? 0),
          0
        )
      : 0;
    const estimatedTextWidth =
      Math.max((longestLabelLength + labelPrefix.length) * 8.2, longestSubtitleLength * 6.1) +
      78 +
      extraWidthPx;

    return Math.max(minWidthPx, Math.ceil(estimatedTextWidth));
  }, [options, showSelectedSubtitle, extraWidthPx, minWidthPx]);

  const safeBottomStyle = useMemo(
    () =>
      ({
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
      }) as React.CSSProperties,
    []
  );

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
    if (!open) return;

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
  }, [open, activeIdx, options, onChange]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
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

  const popW = Math.max(btnW, 220);
  const btnH = compact ? "min-h-[28px]" : "min-h-[44px]";
  const btnPx = compact ? "px-3 pr-8" : "px-4 pr-10";
  const btnText = compact ? "text-xs" : "text-sm";

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`pillselect-${id}`}
        onClick={() => {
          if (!open) {
            setBtnRect(btnRef.current?.getBoundingClientRect() ?? null);
            setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0);
          }
          setOpen((v) => !v);
        }}
        style={{ width: btnW }}
        className={[
          "relative inline-flex justify-between rounded-full",
          showSelectedSubtitle ? "min-h-[58px] items-start py-2.5" : (btnH + " items-center"),
          btnPx,
          btnText,
          "font-medium select-none text-left",
          "bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-sm",
          "hover:bg-[color:var(--pill-hover)] transition-all active:scale-[0.98]",
        ].join(" ")}
      >
        <span className="flex min-w-0 items-start gap-2 text-[color:var(--fg)]">
          {current?.icon ? <span className="mt-0.5 shrink-0 text-[color:var(--fg)]">{current.icon}</span> : null}
          <span className="min-w-0">
            <span className="block truncate">{labelPrefix}{current?.label ?? "Select"}</span>
            {showSelectedSubtitle && current?.subtitle ? (
              <span className="mt-0.5 block truncate text-[11px] font-normal leading-4 text-[color:var(--muted)]">
                {current.subtitle}
              </span>
            ) : null}
          </span>
        </span>

        <span className={["pointer-events-none absolute grid place-items-center opacity-70 text-[color:var(--fg)]", compact ? "right-2.5 h-5 w-5" : "right-3 h-6 w-6"].join(" ")}>
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[50]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={menuRef}
            id={`pillselect-${id}`}
            role="menu"
            className="overflow-hidden rounded-2xl bg-[color:var(--surface-strong)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-pill)]"
            style={{
              position: "fixed",
              top: (btnRect?.bottom ?? 0) + 8,
              ...(align === "left"
                ? { left: btnRect?.left ?? 0 }
                : { right: (typeof window !== "undefined" ? window.innerWidth : 0) - (btnRect?.right ?? 0) }),
              width: popW,
              zIndex: 61,
            }}
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
                      "w-full rounded-xl px-3 py-2.5 text-left transition",
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
                          <CheckIcon className="h-4 w-4" />
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
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
  const canUseDom = typeof document !== "undefined";

  useEffect(() => {
    if (!canUseDom) return;

    lastActiveRef.current = document.activeElement as HTMLElement | null;

    // iOS-safe scroll lock: position:fixed preserves visual position on Safari
    // whereas overflow:hidden alone doesn't reliably prevent rubber-band scrolling
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overscrollBehaviorY = "contain";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overscrollBehaviorY = "";
      // Restore exact scroll position Safari jumps to top without this
      window.scrollTo(0, scrollY);
    };
  }, [canUseDom]);

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

  if (!canUseDom) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        id={id}
        className="absolute bottom-0 left-0 right-0 max-h-[min(78vh,680px)] overflow-y-auto rounded-t-3xl bg-[color:var(--surface-strong)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-pill)]"
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
              <CloseIcon className="h-4 w-4" />
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
                    {isSelected ? (
                      <span className="text-[color:var(--fg)]" aria-hidden="true">
                        <CheckIcon className="h-5 w-5" />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

