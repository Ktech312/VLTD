"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ActionMenuItem = {
  key: string;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Marks the page the person is on (a dot, bold, aria-current). */
  current?: boolean;
};

// Only one menu is open at a time: a menu that opens tells the others, and each closes when another one opens (the Account menu does the same).
export const MENU_OPEN_EVENT = "vltd:menu-open";

/**
 * The shared "menu opened by a button" used for Add Item options and Tools menus.
 * The menu is drawn on the page body, above the app's top and bottom navigation, with an opaque
 * theme surface and 8px corners. Escape closes it and returns focus to the button; Up/Down move
 * between options; scrolling or resizing closes it.
 */
export function ActionMenu({
  items,
  triggerClassName,
  triggerStyle,
  triggerChildren,
  ariaLabel,
  align = "right",
  width = 260,
  placement = "below",
}: {
  items: ActionMenuItem[];
  triggerClassName: string;
  triggerStyle?: CSSProperties;
  triggerChildren: ReactNode;
  ariaLabel: string;
  align?: "left" | "right" | "center";
  width?: number;
  /** Open below the button (default) or above it, for controls that sit at the bottom of the screen. */
  placement?: "below" | "above";
}) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: id }));
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) setOpen(false);
    };
    window.addEventListener(MENU_OPEN_EVENT, onOther);
    return () => window.removeEventListener(MENU_OPEN_EVENT, onOther);
  }, [open, id]);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])") ?? []);
        if (nodes.length === 0) return;
        const at = nodes.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (at + 1) % nodes.length : (at - 1 + nodes.length) % nodes.length;
        nodes[next]?.focus();
      }
    }
    function onScroll(e: Event) {
      const t = e.target as Node | null;
      if (t && menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>("[aria-current='page'][role='menuitem']") ?? menuRef.current?.querySelector<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])");
    first?.focus();
  }, [open]);

  const itemClass =
    "flex w-full min-h-[44px] flex-col justify-center rounded-[6px] px-3 py-2 text-left text-[13px] font-medium text-[color:var(--fg)] transition hover:bg-[color:var(--pill)] focus:bg-[color:var(--pill)] focus:outline-none md:min-h-[36px]";

  return (
    <div className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `actionmenu-${id}` : undefined}
        onClick={() => {
          if (!open) setRect(btnRef.current?.getBoundingClientRect() ?? null);
          setOpen((v) => !v);
        }}
        className={triggerClassName}
        style={triggerStyle}
      >
        {triggerChildren}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[10000]" onClick={() => close(false)} aria-hidden="true" />
              <div
                className="z-[10001] rounded-[8px] bg-[color:var(--bg)]"
                style={{
                  position: "fixed",
                  ...(placement === "above"
                    ? { bottom: (typeof window !== "undefined" ? window.innerHeight : 0) - (rect?.top ?? 0) + 6 }
                    : { top: (rect?.bottom ?? 0) + 6 }),
                  ...(align === "center"
                    ? { left: Math.max(8, Math.min(((rect?.left ?? 0) + (rect?.right ?? 0)) / 2 - Math.min(width, (typeof window !== "undefined" ? window.innerWidth : width) - 16) / 2, (typeof window !== "undefined" ? window.innerWidth : 0) - Math.min(width, (typeof window !== "undefined" ? window.innerWidth : width) - 16) - 8)) }
                    : align === "left"
                    ? { left: Math.max(8, Math.min(rect?.left ?? 0, (typeof window !== "undefined" ? window.innerWidth : 0) - width - 8)) }
                    : { right: Math.max(8, (typeof window !== "undefined" ? window.innerWidth : 0) - (rect?.right ?? 0)) }),
                  width: Math.min(width, (typeof window !== "undefined" ? window.innerWidth : width) - 16),
                }}
              >
                <div
                  ref={menuRef}
                  id={`actionmenu-${id}`}
                  role="menu"
                  aria-label={ariaLabel}
                  className="rounded-[8px] bg-[color:var(--surface-strong)] p-1 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-pill)]"
                >
                  {items.map((item) => {
                    const content = (
                      <>
                        <span className={item.current ? "flex items-center gap-2 font-bold" : undefined}>
                          {item.current ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#4FD3EE" }} /> : null}
                          {item.label}
                        </span>
                        {item.description ? (
                          <span className="text-[11px] font-normal text-[color:var(--muted)]">{item.description}</span>
                        ) : null}
                      </>
                    );
                    if (item.href && !item.disabled) {
                      return (
                        <Link key={item.key} href={item.href} role="menuitem" aria-current={item.current ? "page" : undefined} className={itemClass} onClick={() => { item.onClick?.(); close(false); }}>
                          {content}
                        </Link>
                      );
                    }
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        aria-disabled={item.disabled || undefined}
                        className={itemClass + (item.disabled ? " opacity-60" : "")}
                        onClick={() => {
                          if (item.disabled) return;
                          item.onClick?.();
                          close();
                        }}
                      >
                        {content}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
