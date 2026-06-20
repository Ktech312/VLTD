"use client";

import { useEffect, useRef } from "react";

const DEFAULT_MESSAGE =
  "You have unsaved changes. Are you sure you want to leave? Your progress may be lost.";

export function useUnsavedChangesGuard(enabled: boolean, message = DEFAULT_MESSAGE) {
  const enabledRef = useRef(enabled);
  const messageRef = useRef(message);
  const armedRef = useRef(false);
  const bypassRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
    messageRef.current = message;

    if (enabled) {
      bypassRef.current = false;
    }
  }, [enabled, message]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function armBackButtonGuard() {
      if (armedRef.current) return;
      window.history.pushState(
        { ...(window.history.state ?? {}), vltdUnsavedGuard: true },
        "",
        window.location.href
      );
      armedRef.current = true;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!enabledRef.current || bypassRef.current) return;

      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!enabledRef.current || bypassRef.current || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.href === window.location.href) return;

      if (!window.confirm(messageRef.current)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function handlePopState() {
      if (!enabledRef.current || bypassRef.current) return;

      if (window.confirm(messageRef.current)) {
        bypassRef.current = true;
        window.setTimeout(() => window.history.back(), 0);
        return;
      }

      window.history.pushState(
        { ...(window.history.state ?? {}), vltdUnsavedGuard: true },
        "",
        window.location.href
      );
    }

    if (enabledRef.current) armBackButtonGuard();

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || armedRef.current) return;

    window.history.pushState(
      { ...(window.history.state ?? {}), vltdUnsavedGuard: true },
      "",
      window.location.href
    );
    armedRef.current = true;
  }, [enabled]);
}
