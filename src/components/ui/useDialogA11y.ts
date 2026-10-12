"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog behaviour for modals and sheets: Escape closes, Tab stays inside the dialog,
 * focus moves into the dialog when it opens and returns to the control that opened it when it closes.
 * Attach the returned ref to the dialog's container (the element with role="dialog").
 * Outside-click dismissal stays with each dialog's own backdrop, because what counts as "outside" differs.
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    const node = ref.current;

    // Move focus into the dialog (the container itself when it has nothing focusable yet).
    const focusables = () => (node ? (Array.from(node.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter((el) => el.offsetParent !== null || el === document.activeElement) : []);
    if (node && !node.contains(document.activeElement)) {
      if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
      const first = focusables()[0];
      (first ?? node).focus({ preventScroll: true });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // A menu or select opened inside the dialog handles its own Escape first.
        if (event.defaultPrevented) return;
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !node.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Return focus to the control that opened the dialog, if it is still on the page.
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return ref;
}
