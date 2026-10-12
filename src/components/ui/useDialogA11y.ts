"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, outermost first. Only the innermost one reacts to Escape and Tab, so a dialog opened over another dismisses first.
const openStack: object[] = [];

/**
 * Shared dialog behaviour for modals and sheets: Escape closes, Tab stays inside the dialog,
 * focus moves into the dialog when it opens and returns to the control that opened it when it closes.
 * Attach the returned ref to the dialog's container (the element with role="dialog"). It is a callback ref, so the behaviour
 * starts when the dialog element actually mounts, including dialogs that render through a portal after their first pass.
 * Outside-click dismissal stays with each dialog's own backdrop, because what counts as "outside" differs.
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || !node) return;
    const opener = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;

    // Move focus into the dialog (the container itself when it has nothing focusable yet).
    const focusables = () => (node ? (Array.from(node.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter((el) => el.offsetParent !== null || el === document.activeElement) : []);
    if (node && !node.contains(document.activeElement)) {
      if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
      const first = focusables()[0];
      (first ?? node).focus({ preventScroll: true });
    }

    const token = {};
    openStack.push(token);

    function onKeyDown(event: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== token) return;
      if (event.key === "Escape") {
        // A menu or select opened inside the dialog handles its own Escape first (it closes, then the next Escape closes the dialog).
        if (event.defaultPrevented || document.querySelector('[role="menu"], [role="listbox"]')) return;
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
      const at = openStack.indexOf(token);
      if (at >= 0) openStack.splice(at, 1);
      // Return focus to the control that opened the dialog, if it is still on the page.
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, node]);

  return ref;
}
