// Applies the stored theme before first paint. Mirrors applyTheme() in
// src/lib/prefs.svelte.ts — keep the two in step.
(function () {
  var t = "system";
  try { t = localStorage.getItem("achilles-theme") || "system"; } catch (e) {}
  var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", dark ? "#0f1115" : "#f6f7f9");
})();
