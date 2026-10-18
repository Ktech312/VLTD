// Path: src/components/LoadWatchdog.tsx
/**
 * LoadWatchdog
 * The page is drawn by JavaScript. If that code never arrives or never starts (a file that failed to download after an update, a stalled
 * connection), the person used to see a blank page with no explanation. This runs BEFORE the app's code and:
 *  - records which script or style files failed to download (path only) and which uncaught errors happened (error name only) in the
 *    short per-tab load record (see src/lib/loadDiagnostics.ts, same key);
 *  - if the app has not started after 10 seconds, shows a plain message with a Reload link and a one-line detail of what failed.
 * The app marks itself started from LoadHydratedMark; a late start hides the message again. Nothing here reads or sends page content.
 */
export function LoadWatchdogScript() {
  const code = `
(function () {
  try {
    var KEY = "vltd_load_diag_v1";
    function rec(stage, ok, note) {
      try {
        var a = JSON.parse(sessionStorage.getItem(KEY) || "[]");
        if (!Array.isArray(a)) a = [];
        a.push({ at: Date.now(), ms: Math.round(performance.now()), stage: String(stage).slice(0, 40), ok: ok === true, note: String(note || "").replace(/\\s+/g, " ").slice(0, 90) });
        sessionStorage.setItem(KEY, JSON.stringify(a.slice(-60)));
      } catch (e) {}
    }
    function pathOf(u) { try { return new URL(u, location.href).pathname; } catch (e) { return ""; } }
    rec("page:start", true, location.pathname);
    window.addEventListener("error", function (e) {
      try {
        var el = e && e.target;
        if (el && el !== window && (el.tagName === "SCRIPT" || el.tagName === "LINK")) {
          rec("resource:failed", false, el.tagName.toLowerCase() + " " + pathOf(el.src || el.href));
        } else {
          rec("script:error", false, (e && e.error && e.error.name) || "Error");
        }
      } catch (x) {}
    }, true);
    window.addEventListener("unhandledrejection", function (e) {
      try { rec("promise:rejected", false, (e && e.reason && e.reason.name) || "Error"); } catch (x) {}
    });
    setTimeout(function () {
      if (window.__vltdStarted) return;
      var failed = "";
      try {
        var a = JSON.parse(sessionStorage.getItem(KEY) || "[]");
        failed = a.filter(function (m) { return m && m.ok === false; }).slice(-4).map(function (m) { return m.stage + (m.note ? " (" + m.note + ")" : ""); }).join("; ");
      } catch (e) {}
      rec("hydration:stalled", false, "app not started after 10 s; " + (navigator.onLine === false ? "offline" : "online"));
      var d = document.getElementById("vltd-load-detail");
      if (d) d.textContent = "Step: page code did not start (10 s, " + (navigator.onLine === false ? "offline" : "online") + ")" + (failed ? ". " + failed : "");
      document.documentElement.setAttribute("data-load-stalled", "1");
    }, 10000);
  } catch (e) {}
})();
  `.trim();

  // A plain inline script, NOT next/script: Next runs its "beforeInteractive" scripts from the app's own JavaScript, which is exactly what may fail to
  // download here. This one is part of the HTML and runs as soon as the browser reads it.
  return <script id="load-watchdog" dangerouslySetInnerHTML={{ __html: code }} />;
}

/** Hidden until the watchdog above decides the app did not start. Plain HTML (no JavaScript needed to read it or to reload). */
export function LoadStalledBanner() {
  return (
    <div id="vltd-load-stalled" role="alert">
      <div className="vltd-load-stalled-inner">
        <strong>This page did not finish loading.</strong>
        <span> Your items are safe: nothing here has been changed or lost. Reload the page. If it keeps happening, tell us what the line below says.</span>
        <a href="">Reload this page</a>
        <code id="vltd-load-detail" />
      </div>
    </div>
  );
}
