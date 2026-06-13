"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    // Previously dismissed
    if (localStorage.getItem("vltd_pwa_dismissed")) {
      setDismissed(true);
      return;
    }

    // iOS detection (no beforeinstallprompt support)
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && !/crios/i.test(ua)) {
      setIsIOS(true);
      return;
    }

    // Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem("vltd_pwa_dismissed", "1");
    setDismissed(true);
    setDeferredPrompt(null);
    setIsIOS(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    }
    dismiss();
  }

  if (installed || dismissed) return null;

  // Android/Chrome — native prompt available
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#12101C]/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-4 sm:w-80">
        {/* Vault icon */}
        <img src="/icons/icon-96x96.png" alt="VLTD" className="h-11 w-11 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Add VLTD to Home Screen</p>
          <p className="text-xs text-white/50 mt-0.5">Launch like a native app — no browser needed</p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => void install()}
            className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black transition hover:bg-amber-400"
          >
            Add
          </button>
          <button
            onClick={dismiss}
            className="rounded-full px-3 py-1 text-xs text-white/40 hover:text-white/70 transition"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari — manual instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl border border-white/10 bg-[#12101C]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <img src="/icons/icon-96x96.png" alt="VLTD" className="h-11 w-11 rounded-xl flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white leading-tight">Install VLTD</p>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Tap the{" "}
              <span className="inline-block align-middle">
                {/* Share icon */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline text-white/70">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </span>{" "}
              Share button, then <strong className="text-white/80">Add to Home Screen</strong>
            </p>
          </div>
          <button onClick={dismiss} className="text-white/30 hover:text-white/60 transition mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
