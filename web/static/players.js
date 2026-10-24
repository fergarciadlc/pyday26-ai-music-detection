// Decoder lab: a list of clips beside the codec diagram, and one spectrogram below it.
// Playing a clip lights up its spectrogram and its waveform inside the diagram
// ("pd:select" / "pd:progress" / "pd:stop" events, handled by codec.js).
(function () {
  const list = document.getElementById("spec-players");
  const view = document.getElementById("lab-spec");
  if (!list || !view) return;

  const CLIPS = [
    { name: "original", title: "Original", desc: "Mi guitarra, sin pasar por el codec.", mode: "codec" },
    { name: "reconstruction", title: "Reconstruida", desc: "Encoder → códigos → decoder. Casi igual, 128 veces más chico.", mode: "codec" },
    { name: "random_latents", title: "Latentes al azar", desc: "Números al azar en vez de latentes: ruido.", mode: "gen", gen: ["Ruido aleatorio", "torch.randn_like(latents)"] },
    { name: "zeros", title: "Latentes en cero", desc: "Sin información el decoder igual suena: su huella.", mode: "gen", gen: ["Nada (ceros)", "torch.zeros_like(latents)"] },
  ];
  const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  let media = {};
  let current = null;
  let raf = 0;

  // ---------------------------------------------------------------- spectrogram view
  view.innerHTML = `
    <div class="ls-head"><b></b><span class="ls-time">0:00</span></div>
    <div class="sp-spec" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <img class="sp-dim" alt="">
      <div class="sp-lit"><img alt=""></div>
      <div class="sp-head-line"></div>
      <div class="sp-axis" aria-hidden="true"><span>12 kHz</span><span>3</span><span>0</span></div>
    </div>`;
  const vTitle = view.querySelector(".ls-head b");
  const vTime = view.querySelector(".ls-time");
  const spec = view.querySelector(".sp-spec");
  const dimImg = view.querySelector(".sp-dim");
  const lit = view.querySelector(".sp-lit");
  const litImg = lit.querySelector("img");
  const headLine = view.querySelector(".sp-head-line");
  new ResizeObserver(() => { litImg.style.width = `${spec.clientWidth}px`; }).observe(spec);

  // ---------------------------------------------------------------- list
  const items = CLIPS.map((clip) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "lab-item";
    row.innerHTML = `
      <span class="sp-play" aria-hidden="true">${ICON_PLAY}</span>
      <span class="lab-text"><b>${clip.title}</b><small>${clip.desc}</small>
        <span class="lab-bar"><i></i></span></span>`;
    row.setAttribute("aria-label", `Reproducir ${clip.title}`);
    const audio = new Audio();
    audio.preload = "none";
    audio.src = `${list.dataset.audio}${clip.name}.mp3`;
    const it = { clip, row, audio, icon: row.querySelector(".sp-play"), bar: row.querySelector(".lab-bar i") };
    row.addEventListener("click", () => {
      if (current === it && !audio.paused) audio.pause();
      else play(it);
    });
    audio.addEventListener("pause", () => stopped(it));
    audio.addEventListener("ended", () => { audio.currentTime = 0; render(it); });
    audio.addEventListener("loadedmetadata", () => render(it));
    list.append(row);
    return it;
  });

  const duration = (it) => (isFinite(it.audio.duration) && it.audio.duration) || media[it.clip.name]?.duration || 1;
  const progress = (it) => Math.min(1, it.audio.currentTime / duration(it));

  function render(it) {
    const p = progress(it);
    it.bar.style.width = `${p * 100}%`;
    if (it !== current) return;
    lit.style.width = `${p * 100}%`;
    headLine.style.left = `${p * 100}%`;
    spec.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    vTime.textContent = `${fmt(it.audio.currentTime)} / ${fmt(duration(it))}`;
    document.dispatchEvent(new CustomEvent("pd:progress", { detail: { name: it.clip.name, p } }));
  }

  function show(it, playing) {
    current = it;
    items.forEach((x) => x.row.classList.toggle("is-current", x === it));
    const src = `${list.dataset.spec}${it.clip.name}.jpg`;
    dimImg.src = src;
    litImg.src = src;
    dimImg.alt = `Espectrograma: ${it.clip.title}`;
    vTitle.textContent = it.clip.title;
    spec.setAttribute("aria-label", `Posición en ${it.clip.title}`);
    document.dispatchEvent(new CustomEvent("pd:select", {
      detail: { ...it.clip, playing, wave: media[it.clip.name]?.wave },
    }));
    render(it);
  }

  function play(it) {
    if (current && current !== it) current.audio.pause();
    show(it, true);
    it.audio.play().then(() => {
      it.row.classList.add("is-playing");
      it.icon.innerHTML = ICON_PAUSE;
      it.row.setAttribute("aria-label", `Pausar ${it.clip.title}`);
      document.dispatchEvent(new CustomEvent("pd:select", {
        detail: { ...it.clip, playing: true, wave: media[it.clip.name]?.wave },
      }));
      cancelAnimationFrame(raf);
      const tick = () => {
        render(it);
        if (!it.audio.paused) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).catch(() => {});
  }

  function stopped(it) {
    it.row.classList.remove("is-playing");
    it.icon.innerHTML = ICON_PLAY;
    it.row.setAttribute("aria-label", `Reproducir ${it.clip.title}`);
    render(it);
    if (current === it) document.dispatchEvent(new Event("pd:stop"));
  }

  function seek(frac) {
    const it = current;
    const f = Math.min(Math.max(frac, 0), 0.999);
    const apply = () => { it.audio.currentTime = f * duration(it); render(it); };
    if (it.audio.readyState >= 1) apply();
    else { it.audio.preload = "metadata"; it.audio.addEventListener("loadedmetadata", apply, { once: true }); it.audio.load(); }
  }
  spec.addEventListener("click", (e) => {
    const r = spec.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width);
  });
  spec.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" ? 0.05 : e.key === "ArrowLeft" ? -0.05 : 0;
    if (step) { e.preventDefault(); seek(progress(current) + step); }
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); current.row.click(); }
  });

  // Show the original until something is played (without touching the diagram).
  current = items[0];
  items[0].row.classList.add("is-current");
  dimImg.src = litImg.src = `${list.dataset.spec}original.jpg`;
  vTitle.textContent = "Elige un audio y dale play";

  fetch(list.dataset.media)
    .then((r) => r.json())
    .then((m) => { media = m; items.forEach(render); })
    .catch(() => {});
})();
