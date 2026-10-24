// Spectrogram players: each clip plays over its spectrogram, which lights up as it plays.
// Selecting a clip tells the codec diagram which path produced it ("pd:select").
(function () {
  const root = document.getElementById("spec-players");
  if (!root) return;

  const CLIPS = [
    { name: "original", title: "Original", desc: "Una grabación mía de guitarra.", mode: "codec" },
    { name: "reconstruccion", title: "Reconstruida", desc: "Encoder → códigos → decoder. Casi igual, en un archivo 128 veces más chico.", mode: "codec" },
    { name: "aleatorios", title: "Latentes al azar", desc: "Números al azar en vez de latentes reales: ruido por todas partes.", mode: "gen", gen: ["Ruido aleatorio", "torch.randn_like(latentes)"] },
    { name: "ceros", title: "Latentes en cero", desc: "Sin información, el decoder igual suena: líneas fijas que no cambian. Es su huella.", mode: "gen", gen: ["Nada (ceros)", "torch.zeros_like(latentes)"] },
  ];
  const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  let media = {};
  let current = null;
  let raf = 0;

  const cards = CLIPS.map((clip) => {
    const card = document.createElement("article");
    card.className = "sp";
    card.innerHTML = `
      <div class="sp-head">
        <button class="sp-play" type="button" aria-label="Reproducir ${clip.title}">${ICON_PLAY}</button>
        <div><b>${clip.title}</b><p>${clip.desc}</p></div>
        <span class="sp-time">0:00</span>
      </div>
      <div class="sp-spec" role="slider" tabindex="0" aria-label="Posición en ${clip.title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <img class="sp-dim" src="${root.dataset.spec}${clip.name}.jpg" alt="Espectrograma: ${clip.title}">
        <div class="sp-lit"><img src="${root.dataset.spec}${clip.name}.jpg" alt=""></div>
        <div class="sp-head-line"></div>
        <div class="sp-axis" aria-hidden="true"><span>12 kHz</span><span>3</span><span>0</span></div>
      </div>`;
    const audio = new Audio();
    audio.preload = "none";
    audio.src = `${root.dataset.audio}${clip.name}.mp3`;
    const ui = {
      play: card.querySelector(".sp-play"),
      time: card.querySelector(".sp-time"),
      spec: card.querySelector(".sp-spec"),
      lit: card.querySelector(".sp-lit"),
      line: card.querySelector(".sp-head-line"),
    };
    const c = { clip, card, audio, ui };
    // The lit copy is clipped by its container, so it must keep the full spectrogram width.
    const litImg = ui.lit.querySelector("img");
    new ResizeObserver(() => { litImg.style.width = `${ui.spec.clientWidth}px`; }).observe(ui.spec);

    ui.play.addEventListener("click", () => (audio.paused ? play(c) : audio.pause()));
    ui.spec.addEventListener("click", (e) => {
      const r = ui.spec.getBoundingClientRect();
      seek(c, (e.clientX - r.left) / r.width);
    });
    ui.spec.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 0.05 : e.key === "ArrowLeft" ? -0.05 : 0;
      if (step) { e.preventDefault(); seek(c, progress(c) + step); }
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); ui.play.click(); }
    });
    audio.addEventListener("pause", () => stopped(c));
    audio.addEventListener("ended", () => { audio.currentTime = 0; render(c); });
    audio.addEventListener("loadedmetadata", () => render(c));
    root.append(card);
    return c;
  });

  const duration = (c) => (isFinite(c.audio.duration) && c.audio.duration) || media[c.clip.name]?.duration || 1;
  const progress = (c) => Math.min(1, c.audio.currentTime / duration(c));

  function render(c) {
    const p = progress(c);
    c.ui.lit.style.width = `${p * 100}%`;
    c.ui.line.style.left = `${p * 100}%`;
    c.ui.spec.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    c.ui.time.textContent = `${fmt(c.audio.currentTime)} / ${fmt(duration(c))}`;
  }

  function select(c, playing) {
    cards.forEach((x) => x.card.classList.toggle("is-current", x === c));
    document.dispatchEvent(new CustomEvent("pd:select", {
      detail: { ...c.clip, playing, wave: media[c.clip.name]?.wave },
    }));
  }

  function play(c) {
    if (current && current !== c) current.audio.pause();
    current = c;
    c.audio.play().then(() => {
      c.card.classList.add("is-playing");
      c.ui.play.innerHTML = ICON_PAUSE;
      c.ui.play.setAttribute("aria-label", `Pausar ${c.clip.title}`);
      select(c, true);
      cancelAnimationFrame(raf);
      const tick = () => {
        render(c);
        if (!c.audio.paused) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).catch(() => {});
  }

  function stopped(c) {
    c.card.classList.remove("is-playing");
    c.ui.play.innerHTML = ICON_PLAY;
    c.ui.play.setAttribute("aria-label", `Reproducir ${c.clip.title}`);
    render(c);
    if (current === c) document.dispatchEvent(new Event("pd:stop"));
  }

  function seek(c, frac) {
    const f = Math.min(Math.max(frac, 0), 0.999);
    const apply = () => { c.audio.currentTime = f * duration(c); render(c); };
    if (c.audio.readyState >= 1) apply();
    else { c.audio.preload = "metadata"; c.audio.addEventListener("loadedmetadata", apply, { once: true }); c.audio.load(); }
    if (c.audio.paused) select(c, false);
  }

  fetch(root.dataset.media)
    .then((r) => r.json())
    .then((m) => { media = m; cards.forEach(render); })
    .catch(() => cards.forEach(render));
})();
