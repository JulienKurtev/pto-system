export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

/**
 * Inline <head> script: resolves the saved preference (default "system")
 * to data-theme="light|dark" on <html> before first paint, follows OS
 * changes while on "system", and exposes window.__applyTheme for the toggle.
 */
export const THEME_SCRIPT = `(function () {
  var mq = matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    var pref;
    try { pref = localStorage.getItem("${THEME_STORAGE_KEY}"); } catch (e) {}
    var dark = pref === "dark" || (pref !== "light" && mq.matches);
    var root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
  }
  apply();
  mq.addEventListener("change", apply);
  window.__applyTheme = apply;
})();`;
