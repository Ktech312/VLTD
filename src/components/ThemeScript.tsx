// Path: src/components/ThemeScript.tsx
import Script from "next/script";

/**
 * ThemeScript
 * Runs BEFORE hydration to set:
 * - html.dark (theme mode)
 * - html.theme-mirror / html.theme-purple (palette)
 *
 * Prevents:
 * - Theme flash
 * - Hydration mismatch from class differences
 */
export default function ThemeScript() {
  const code = `
(function () {
  try {
    var LS_THEME_MODE = "vltd_theme_mode";
    var LS_PALETTE = "vltd_palette";

    var mode = localStorage.getItem(LS_THEME_MODE);
    if (mode !== "system" && mode !== "dark" && mode !== "light") mode = "system";

    var palette = localStorage.getItem(LS_PALETTE);
    if (palette !== "mirror" && palette !== "purple") palette = "mirror";

    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var shouldBeDark = (mode === "dark") ? true : (mode === "light") ? false : !!prefersDark;

    var root = document.documentElement;

    // Theme class
    if (shouldBeDark) root.classList.add("dark");
    else root.classList.remove("dark");

    // Palette class
    root.classList.remove("theme-mirror", "theme-purple");
    root.classList.add(palette === "purple" ? "theme-purple" : "theme-mirror");
  } catch (e) {}
})();
  `.trim();

  return (
    <Script
      id="theme-script"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}