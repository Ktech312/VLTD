"use client";

import { useEffect } from "react";

// Classic mobile-Safari trick: nudging the scroll position 1px on load makes
// the browser collapse its own address bar, the same way EK noticed another
// site starting "slightly lower" than expected. Not something a page can
// force outright (browser chrome isn't controllable via CSS/JS) -- this just
// gives the browser's own auto-hide-on-scroll behavior something to react to
// immediately, instead of waiting for the user to scroll first.
export default function AddressBarHider() {
  useEffect(() => {
    function hide() {
      // Already scrolled, or nothing to scroll (page fits the viewport) --
      // either way there's nothing useful to do, and scrollTo(0,1) on a page
      // with no overflow would be a no-op anyway.
      if (window.scrollY > 0) return;
      if (document.documentElement.scrollHeight <= window.innerHeight + 1) return;
      window.scrollTo(0, 1);
    }

    // Fire early, then again once fonts/images have likely settled and
    // could have changed the page's real scrollable height. "pageshow"
    // covers iOS Safari's back-forward cache restoring a page without a
    // fresh "load" event.
    const t1 = window.setTimeout(hide, 0);
    const t2 = window.setTimeout(hide, 350);
    window.addEventListener("load", hide);
    window.addEventListener("pageshow", hide);
    window.addEventListener("orientationchange", hide);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("load", hide);
      window.removeEventListener("pageshow", hide);
      window.removeEventListener("orientationchange", hide);
    };
  }, []);

  return null;
}
