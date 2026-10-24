// Page chrome: light/dark toggle and the collapsible quiz.
(function () {
  // ---------------------------------------------------------------- theme
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const stored = () => { try { return localStorage.getItem("theme"); } catch (_) { return null; } };
  const store = (t) => { try { localStorage.setItem("theme", t); } catch (_) { /* private mode */ } };
  const apply = (t) => {
    root.dataset.theme = t;
    const btn = document.querySelector(".theme-toggle");
    if (btn) btn.setAttribute("aria-label", t === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  };
  apply(stored() || (media.matches ? "dark" : "light"));
  media.addEventListener("change", (e) => { if (!stored()) apply(e.matches ? "dark" : "light"); });
  document.querySelector(".theme-toggle")?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    store(next);
    apply(next);
  });

  // ---------------------------------------------------------------- quiz
  const btn = document.querySelector(".quiz-open");
  const body = document.getElementById(btn?.getAttribute("aria-controls"));
  if (btn && body) {
    const label = btn.querySelector("span");
    const set = (open) => {
      body.classList.toggle("open", open);
      body.inert = !open;
      btn.setAttribute("aria-expanded", String(open));
      label.textContent = open ? "Ocultar el experimento" : "Hacer el experimento";
      if (!open) body.querySelectorAll("audio").forEach((a) => a.pause());
    };
    set(false);
    btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  }
})();
