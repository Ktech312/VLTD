"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "vltd_pwa_dismissed_until";
const INSTALLED_KEY = "vltd_pwa_installed";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);
  const [iosExpanded, setIosExpanded] = useState(false);

  useEffect(() => {
    // EK's ask (2026-08-21): the banner kept coming back after a real
    // install. Root cause — a successful install used to just clear the
    // dismiss-cooldown key instead of recording that the app was actually
    // installed, so there was nothing permanent stopping it from showing
    // again (e.g. the next time `beforeinstallprompt` fires, or on a load
    // that isn't in standalone display mode — which happens even on an
    // installed device if the app is opened as a normal browser tab
    // instead of via the home-screen icon). This permanent flag is the
    // actual "don't show again" — checked first, before the cooldown.
    if (localStorage.getItem(INSTALLED_KEY) === "true") return;

    // Already installed as PWA (this specific launch is running standalone)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      localStorage.setItem(INSTALLED_KEY, "true");
      return;
    }

    // Fires on ANY successful install — this banner's own button, the
    // browser's own address-bar install icon, whatever. More reliable
    // than only trusting this component's own install() flow.
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      setShow(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    // Within cooldown window
    const until = localStorage.getItem(DISMISSED_KEY);
    if (until && Date.now() < Number(until)) {
      return () => window.removeEventListener("appinstalled", onInstalled);
    }

    // iOS detection (no beforeinstallprompt support)
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && !/crios/i.test(ua)) {
      setIsIOS(true);
      setShow(true);
      return () => window.removeEventListener("appinstalled", onInstalled);
    }

    // Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + COOLDOWN_MS));
    setShow(false);
    setDeferredPrompt(null);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "true");
    }
    setShow(false);
    setDeferredPrompt(null);
  }

  if (!show) return null;

  // Small floating pill — bottom-left, above the bottom nav
  const pillStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "calc(var(--bottomnav-h, 64px) + max(env(safe-area-inset-bottom, 0px), 0px) + 12px)",
    left: 16,
    zIndex: 9998,
    maxWidth: 280,
  };

  const XButton = () => (
    <button
      onClick={dismiss}
      aria-label="Dismiss"
      style={{ minHeight: 36, minWidth: 36 }}
      className="flex items-center justify-center text-white/40 hover:text-white/70 transition flex-shrink-0"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );

  // Android/Chrome — native prompt available
  if (deferredPrompt) {
    return (
      <div
        style={pillStyle}
        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#12101C]/95 px-2 py-1.5 shadow-xl backdrop-blur-xl"
      >
        <img src="/icons/icon-96x96.png" alt="VLTD" className="h-6 w-6 rounded-lg flex-shrink-0" />
        <p className="text-[11px] font-semibold text-white whitespace-nowrap">Add to Home Screen</p>
        <button
          onClick={() => void install()}
          aria-label="Install"
          style={{ minHeight: 28, minWidth: 28 }}
          className="flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 transition flex-shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <path d="M12 3v13M5 16l7 7 7-7"/>
            <path d="M4 21h16" strokeLinecap="round"/>
          </svg>
        </button>
        <XButton />
      </div>
    );
  }

  // iOS Safari — no install API exists, so tapping opens clear step-by-step
  // instructions instead of silently doing nothing.
  if (isIOS) {
    return (
      <div
        style={pillStyle}
        className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#12101C]/95 px-2 py-1.5 shadow-xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-1.5">
          <img src="/icons/icon-96x96.png" alt="VLTD" className="h-6 w-6 rounded-lg flex-shrink-0" />
          <button
            type="button"
            onClick={() => setIosExpanded((v) => !v)}
            className="flex-1 text-left text-[11px] font-semibold text-white whitespace-nowrap"
          >
            Tap <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline align-middle text-white/60"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> → Add to Home Screen
          </button>
          <XButton />
        </div>
        {iosExpanded && (
          <p className="max-w-[240px] text-[10px] leading-snug text-white/70">
            1. Tap the Share icon in Safari&apos;s toolbar.<br />
            2. Scroll down and tap &quot;Add to Home Screen.&quot;
          </p>
        )}
      </div>
    );
  }

  return null;
}
