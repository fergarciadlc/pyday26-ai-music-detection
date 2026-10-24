// Fakeprints panel: original vs EnCodec, listenable (synced A/B) and visible.
// Data and audio are precomputed by scripts/build_fakeprints.py.
(function () {
  const root = document.getElementById("fp-panel");
  if (!root) return;
  const base = root.dataset.base;

  const VIEWS = [
    ["original", "Original"],
    ["encodec", "EnCodec"],
    ["diff", "Diferencia"],
  ];
  const RANGES = [
    [[2000, 11500], "2–11.5 kHz"],
    [[5800, 7400], "Zoom 5.8–7.4 kHz"],
    [[0, 12000], "0–12 kHz"],
  ];
  const DIFF_GAIN = 0.6; // the difference file is normalised; keep it from being startling
  const state = { bw: "3", view: "encodec", range: RANGES[0][0], grid: true };
  let data;

  const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
  const el = (tag, attrs = {}, html = "") => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    n.innerHTML = html;
    return n;
  };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const kbps = (bw) => `${bw} kbps`;

  // ---------------------------------------------------------------- audio
  let ctx = null;
  let sources = [];
  let gains = {};
  let startAt = 0;
  let offset = 0;
  let startOffset = 0;
  let loopLength = 0;
  let playing = false;
  let loading = false;
  let raf = 0;
  let token = 0;
  const buffers = new Map();

  const keyFor = (view, bw) => (view === "original" ? "original" : view === "encodec" ? bw : `diff_${bw}`);
  const gainFor = (view) => (view !== state.view ? 0 : view === "diff" ? DIFF_GAIN : 1);

  function load(key) {
    if (!buffers.has(key)) {
      const p = fetch(`${base}${key}.mp3`)
        .then((r) => {
          if (!r.ok) throw new Error(`${key}.mp3: ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => ctx.decodeAudioData(b));
      p.catch(() => buffers.delete(key));
      buffers.set(key, p);
    }
    return buffers.get(key);
  }

  // Loop length: the decoded buffer's, which can differ slightly from
  // data.duration (MP3 padding is trimmed by some browsers and not others).
  const loopLen = () => loopLength || data.duration;

  function position() {
    if (!playing) return offset;
    return (startOffset + Math.max(0, ctx.currentTime - startAt)) % loopLen();
  }

  function stopSources() {
    sources.forEach((s) => {
      try { s.stop(); } catch (_) { /* already stopped */ }
    });
    sources = [];
    gains = {};
  }

  function setLoading(on) {
    loading = on;
    if (on) ui.play.setAttribute("aria-busy", "true");
    else ui.play.removeAttribute("aria-busy");
  }

  // Start (or restart) the three versions together. `at` forces a position;
  // otherwise a restart continues from where playback is once loading ends.
  async function start(at) {
    const my = ++token;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    setLoading(true);
    let bufs;
    try {
      bufs = await Promise.all(VIEWS.map(([v]) => load(keyFor(v, state.bw))));
    } catch (err) {
      if (my !== token) return;
      setLoading(false);
      pause();
      ui.note.textContent = `No se pudo cargar el audio (${err.message}).`;
      return;
    }
    if (my !== token) return; // a newer start/pause superseded this one
    setLoading(false);
    offset = at ?? position();
    stopSources();
    loopLength = bufs[0].duration;
    offset %= loopLength;
    const t0 = ctx.currentTime + 0.03;
    VIEWS.forEach(([v], i) => {
      const s = ctx.createBufferSource();
      s.buffer = bufs[i];
      s.loop = true;
      const g = ctx.createGain();
      g.gain.value = gainFor(v);
      s.connect(g).connect(ctx.destination);
      s.start(t0, offset);
      sources.push(s);
      gains[v] = g;
    });
    startAt = t0;
    startOffset = offset;
    playing = true;
    renderPlay();
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function pause() {
    token++;
    setLoading(false);
    if (playing) offset = position();
    playing = false;
    stopSources();
    renderPlay();
    renderPlayhead();
  }

  function seek(frac) {
    const at = Math.min(Math.max(frac, 0), 0.999) * loopLen();
    if (playing || loading) {
      start(at); // restart all three sources at the new position
    } else {
      offset = at;
      renderPlayhead();
    }
  }

  function tick() {
    raf = 0;
    if (!playing) return;
    renderPlayhead();
    raf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- layout
  const ui = {};

  function build() {
    root.innerHTML = "";
    root.classList.add("fp");

    const controls = el("div", { class: "fp-controls" });
    ui.play = el("button", { class: "fp-play", type: "button", "aria-label": "Reproducir" });
    ui.time = el("span", { class: "fp-time", "aria-live": "off" });
    const player = el("div", { class: "fp-group" });
    const playerRow = el("div", { style: "display:flex;align-items:center;gap:.7rem" });
    playerRow.append(ui.play, ui.time);
    player.append(el("span", {}, "Reproducir"), playerRow);

    ui.views = segmented("Escuchar", VIEWS.map(([v, label]) => [v, label]), state.view, setView);
    ui.bws = segmented("Bitrate de EnCodec", data.bandwidths.map((b) => [b, kbps(b)]), state.bw, setBw);
    controls.append(player, ui.views.group, ui.bws.group);

    ui.note = el("p", { class: "fp-note" });

    // Spectrograms
    const specs = el("div", { class: "fp-specs" });
    ui.specTop = spectrogramRow();
    ui.specBottom = spectrogramRow();
    specs.append(ui.specTop.row, ui.specBottom.row);

    // Chart 1: folded comb
    const c1 = el("section", { class: "fp-chart" });
    c1.append(
      el("h3", {}, "La huella: el espectro doblado cada 600 Hz"),
      el("p", { class: "fp-sub" },
        "Cortamos el espectro (de 2 a 11.5 kHz) en pedazos de 600 Hz y los ponemos uno encima del otro. " +
        "Las notas se promedian; los picos del decoder caen siempre en el centro y se suman."),
    );
    ui.tiles = el("div", { class: "fp-tiles" });
    ui.legend1 = el("div", { class: "fp-legend" });
    ui.fold = chartCanvas(240, "Espectro doblado módulo 600 Hz, original contra EnCodec");
    c1.append(ui.tiles, ui.legend1, ui.fold.wrap);

    // Chart 2: high-resolution spectrum, small multiples
    const c2 = el("section", { class: "fp-chart" });
    const c2ctrl = el("div", { class: "fp-controls", style: "margin:.2rem 0 .6rem" });
    ui.ranges = segmented("Rango", RANGES.map(([r, label]) => [r.join("-"), label]), state.range.join("-"), setRange);
    ui.gridToggle = el("label", { class: "fp-check" }, `<input type="checkbox" checked> Marcar múltiplos de 600 Hz`);
    ui.gridToggle.querySelector("input").addEventListener("change", (e) => {
      state.grid = e.target.checked;
      drawSpectrum();
    });
    c2ctrl.append(ui.ranges.group, ui.gridToggle);
    c2.append(
      el("h3", {}, "Espectro promedio de alta resolución"),
      el("p", { class: "fp-sub" },
        "Todo el audio promediado con resolución de 1 Hz, dejando solo los picos. " +
        "Las notas de la guitarra aparecen en los dos; en EnCodec además hay picos sobre la rejilla amarilla."),
      c2ctrl,
    );
    ui.spec = chartCanvas(300, "Espectro promedio de alta resolución, original arriba y EnCodec abajo");
    c2.append(ui.spec.wrap);

    // Table view
    const details = el("details", { class: "fp-table" });
    details.append(el("summary", {}, "Ver los números por bitrate"));
    ui.table = el("div");
    details.append(ui.table);

    const charts = el("div", { class: "fp-charts" });
    charts.append(c1, c2, details);
    root.append(controls, ui.note, specs, charts);

    ui.play.addEventListener("click", () => (playing || loading ? pause() : start()));
    hover(ui.fold, foldTip);
    hover(ui.spec, specTip);
  }

  function segmented(label, items, value, onChange) {
    const group = el("div", { class: "fp-group" });
    const seg = el("div", { class: "fp-seg", role: "group", "aria-label": label });
    const buttons = items.map(([v, text]) => {
      const b = el("button", { type: "button", "aria-pressed": String(v === value), "data-v": v }, text);
      b.addEventListener("click", () => {
        buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        onChange(v);
      });
      seg.append(b);
      return b;
    });
    group.append(el("span", {}, label), seg);
    return { group, buttons };
  }

  function spectrogramRow() {
    const row = el("div", { class: "fp-spec" });
    const label = el("div", { class: "fp-spec-label" });
    const box = el("div", { class: "fp-spec-img", title: "Haz clic para saltar a ese momento" });
    const img = el("img", { alt: "", loading: "lazy" });
    const head = el("div", { class: "fp-playhead" });
    const axis = el("div", { class: "fp-yaxis", "aria-hidden": "true" }, "<span>12 kHz</span><span>6 kHz</span><span>0</span>");
    box.append(img, head, axis);
    box.addEventListener("click", (e) => {
      const r = box.getBoundingClientRect();
      seek((e.clientX - r.left) / r.width);
    });
    row.append(label, box);
    return { row, label, img, head };
  }

  function chartCanvas(height, aria) {
    const wrap = el("div", { class: "fp-canvas-wrap" });
    const canvas = el("canvas", { role: "img", "aria-label": aria });
    const tip = el("div", { class: "fp-tip", hidden: "" });
    wrap.append(canvas, tip);
    return { wrap, canvas, tip, height, geom: null };
  }

  // ---------------------------------------------------------------- state changes
  function setView(v) {
    state.view = v;
    if (playing) {
      for (const [name] of VIEWS) gains[name].gain.setTargetAtTime(gainFor(name), ctx.currentTime, 0.015);
    }
    renderSpecs();
  }

  function setBw(bw) {
    state.bw = bw;
    if (playing || loading) start();
    renderAll();
  }

  function setRange(r) {
    state.range = r.split("-").map(Number);
    drawSpectrum();
  }

  // ---------------------------------------------------------------- render
  function renderPlay() {
    ui.play.setAttribute("aria-label", playing ? "Pausa" : "Reproducir");
    ui.play.innerHTML = playing
      ? '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
  }

  function renderPlayhead() {
    const t = position();
    const pct = `${(100 * t) / loopLen()}%`;
    ui.specTop.head.style.left = pct;
    ui.specBottom.head.style.left = pct;
    ui.time.textContent = `${fmtTime(t)} / ${fmtTime(loopLen())}`;
  }

  function renderSpecs() {
    const v = data.versions;
    const bw = state.bw;
    const diff = state.view === "diff";
    ui.specTop.img.src = `${base}original.jpg`;
    ui.specTop.img.alt = "Espectrograma de la grabación original";
    ui.specTop.label.innerHTML = "<b>Original</b><span>grabación de guitarra</span>";
    ui.specBottom.img.src = `${base}${diff ? "diff_" : ""}${bw}.jpg`;
    ui.specBottom.img.alt = diff
      ? `Espectrograma de la diferencia entre EnCodec a ${kbps(bw)} y el original`
      : `Espectrograma tras EnCodec a ${kbps(bw)}`;
    ui.specBottom.label.innerHTML = diff
      ? `<b>Diferencia · ${kbps(bw)}</b><span>EnCodec − original, amplificada</span>`
      : `<b>EnCodec · ${kbps(bw)}</b><span>SNR ${v[bw].snr_db} dB respecto al original</span>`;
    ui.specTop.row.classList.toggle("is-live", state.view === "original");
    ui.specBottom.row.classList.toggle("is-live", state.view !== "original");
    ui.note.textContent = diff
      ? `La diferencia está ${v[bw].snr_db} dB por debajo de la música; aquí se oye amplificada para que se escuchen los artefactos.`
      : "Cambia entre Original y EnCodec mientras suena: el audio sigue en el mismo punto.";
  }

  function renderTiles() {
    const v = data.versions;
    const tile = (sw, label, value, unit) =>
      `<div class="fp-tile"><span><i class="sw" style="background:${sw}"></i>${label}</span><b>${value}<small> ${unit}</small></b></div>`;
    const sign = (x) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(1);
    ui.tiles.innerHTML =
      tile(css("--pd-orig"), "Original: picos en la rejilla", sign(v.original.comb_db), "dB") +
      tile(css("--pd-enc"), `EnCodec ${kbps(state.bw)}: picos en la rejilla`, sign(v[state.bw].comb_db), "dB");
    ui.legend1.innerHTML =
      `<span><i style="background:${css("--pd-orig")}"></i>Original</span>` +
      `<span><i style="background:${css("--pd-enc")}"></i>EnCodec · ${kbps(state.bw)}</span>` +
      `<span class="comb"><i></i>múltiplos de 600 Hz</span>`;
  }

  function renderTable() {
    const v = data.versions;
    const rows = data.bandwidths
      .map((b) => `<tr><td>${kbps(b)}</td><td>${v[b].snr_db} dB</td><td>${v[b].comb_db >= 0 ? "+" : ""}${v[b].comb_db} dB</td></tr>`)
      .join("");
    ui.table.innerHTML =
      `<table><thead><tr><th>Versión</th><th>SNR vs. original</th><th>Picos en múltiplos de 600 Hz</th></tr></thead><tbody>` +
      `<tr><td>Original</td><td>—</td><td>${v.original.comb_db >= 0 ? "+" : ""}${v.original.comb_db} dB</td></tr>${rows}</tbody></table>` +
      `<p class="fp-note">"Picos en la rejilla": nivel medio del espectro residual a ±2 Hz de cada múltiplo de 600 Hz, menos el nivel medio en el resto de la banda 2–11.5 kHz.</p>`;
  }

  function renderAll() {
    renderSpecs();
    renderTiles();
    renderTable();
    renderPlayhead();
    drawFold();
    drawSpectrum();
  }

  // ---------------------------------------------------------------- charts
  function prep(chart) {
    const dpr = window.devicePixelRatio || 1;
    const w = chart.wrap.clientWidth;
    const h = chart.height;
    chart.canvas.width = Math.round(w * dpr);
    chart.canvas.height = Math.round(h * dpr);
    chart.canvas.style.height = `${h}px`;
    const c = chart.canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.font = `11px ${css("--md-text-font-family") || "sans-serif"}`;
    return { c, w, h };
  }

  function niceStep(span, target) {
    const raw = span / target;
    const p = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  }

  function axes(c, g, yTicks, xTicks, xFmt, yFmt) {
    c.strokeStyle = css("--pd-grid");
    c.fillStyle = css("--pd-muted");
    c.lineWidth = 1;
    c.textAlign = "right";
    c.textBaseline = "middle";
    yTicks.forEach((y) => {
      const py = g.y(y);
      c.beginPath();
      c.moveTo(g.x0, py + 0.5);
      c.lineTo(g.x1, py + 0.5);
      c.stroke();
      c.fillText(yFmt(y), g.x0 - 6, py);
    });
    c.textBaseline = "top";
    xTicks.forEach((x) => {
      const px = g.x(x);
      // Keep edge labels inside the canvas.
      c.textAlign = px - g.x0 < 30 ? "left" : g.x1 - px < 30 ? "right" : "center";
      c.fillText(xFmt(x), px, g.y1 + 6);
    });
  }

  function line(c, xs, ys, g, color) {
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.lineJoin = "round";
    c.beginPath();
    xs.forEach((x, i) => (i ? c.lineTo(g.x(x), g.y(ys[i])) : c.moveTo(g.x(x), g.y(ys[i]))));
    c.stroke();
  }

  function drawFold() {
    const chart = ui.fold;
    const { c, w, h } = prep(chart);
    const o = data.versions.original.folded;
    const e = data.versions[state.bw].folded;
    const n = o.length;
    const half = n / 2;
    const xs = o.map((_, i) => i - half);
    const all = o.concat(e);
    const lo = Math.floor(Math.min(...all) - 0.5);
    const hi = Math.ceil(Math.max(...all) + 0.5);
    const g = { x0: 56, x1: w - 12, y0: 10, y1: h - 26 };
    g.x = (x) => g.x0 + ((x + half) / (n - 1)) * (g.x1 - g.x0);
    g.y = (y) => g.y1 - ((y - lo) / (hi - lo)) * (g.y1 - g.y0);
    const step = niceStep(hi - lo, 4);
    const yt = [];
    for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) yt.push(y);
    const xt = w < 520 ? [-300, 0, 300] : [-300, -150, 0, 150, 300];
    axes(c, g, yt, xt, (x) => (x === 0 ? "múltiplo de 600 Hz" : `${x > 0 ? "+" : "−"}${Math.abs(x)} Hz`), (y) => `${y} dB`);
    c.fillStyle = css("--pd-comb");
    c.fillRect(g.x(0) - 1.5, g.y0, 3, g.y1 - g.y0);
    line(c, xs, o, g, css("--pd-orig"));
    line(c, xs, e, g, css("--pd-enc"));
    chart.geom = { g, xs, series: [["Original", o, "--pd-orig"], [`EnCodec ${kbps(state.bw)}`, e, "--pd-enc"]], unit: "offset" };
  }

  function drawSpectrum() {
    const chart = ui.spec;
    const { c, w, h } = prep(chart);
    const [f0, f1] = state.range;
    const panels = [
      ["Original", data.versions.original.spectrum, "--pd-orig"],
      [`EnCodec · ${kbps(state.bw)}`, data.versions[state.bw].spectrum, "--pd-enc"],
    ];
    let hi = 0;
    panels.forEach(([, s]) => { for (let f = f0; f <= f1; f++) hi = Math.max(hi, s[f] || 0); });
    hi = Math.ceil(hi / 5) * 5 || 5;
    const gap = 22;
    const ph = (h - 26 - 10 - gap) / 2;
    const geoms = panels.map((_, i) => {
      const g = { x0: 56, x1: w - 12, y0: 10 + i * (ph + gap), y1: 10 + i * (ph + gap) + ph };
      g.x = (f) => g.x0 + ((f - f0) / (f1 - f0)) * (g.x1 - g.x0);
      g.y = (v) => g.y1 - (v / hi) * (g.y1 - g.y0);
      return g;
    });
    const span = f1 - f0;
    const xStep = niceStep(span, 6);
    const xt = [];
    for (let f = Math.ceil(f0 / xStep) * xStep; f <= f1; f += xStep) xt.push(f);
    const fmtF = (f) => (span <= 3000 ? `${(f / 1000).toFixed(1)} kHz` : `${f / 1000} kHz`);

    panels.forEach(([name, s, color], i) => {
      const g = geoms[i];
      axes(c, g, [0, hi / 2, hi], i === 1 ? xt : [], fmtF, (y) => `${y} dB`);
      if (state.grid) {
        c.fillStyle = css("--pd-comb");
        for (let f = Math.ceil(f0 / 600) * 600; f <= f1; f += 600) c.fillRect(g.x(f) - 1, g.y0, 2, g.y1 - g.y0);
      }
      // One vertical segment per pixel column (max of the bins it covers) keeps every peak visible.
      c.strokeStyle = css(color);
      c.lineWidth = span / (g.x1 - g.x0) > 1.5 ? 1 : 1.5;
      c.beginPath();
      const cols = Math.round(g.x1 - g.x0);
      for (let px = 0; px <= cols; px++) {
        const a = Math.floor(f0 + (px / cols) * span);
        const b = Math.max(a, Math.floor(f0 + ((px + 1) / cols) * span) - 1);
        let m = 0;
        for (let f = a; f <= b && f < s.length; f++) m = Math.max(m, s[f]);
        const X = g.x0 + px;
        px ? c.lineTo(X, g.y(m)) : c.moveTo(X, g.y(m));
      }
      c.stroke();
      c.fillStyle = css("--pd-ink");
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText(name, g.x0 + 6, g.y0 + 2);
    });
    chart.geom = { panels, geoms, f0, f1 };
  }

  // ---------------------------------------------------------------- hover
  function hover(chart, fn) {
    const { canvas, tip } = chart;
    const hide = () => { tip.hidden = true; redrawCrosshair(chart, null); };
    canvas.addEventListener("pointermove", (ev) => {
      if (!chart.geom) return;
      const r = canvas.getBoundingClientRect();
      const res = fn(chart, ev.clientX - r.left, ev.clientY - r.top);
      if (!res) return hide();
      tip.innerHTML = res.html;
      tip.hidden = false;
      const half = tip.offsetWidth / 2 + 4;
      tip.style.left = `${Math.min(Math.max(res.x, half), canvas.clientWidth - half)}px`;
      tip.style.top = `${res.y}px`;
      redrawCrosshair(chart, res.x);
    });
    canvas.addEventListener("pointerleave", hide);
  }

  function redrawCrosshair(chart, x) {
    if (chart === ui.fold) drawFold(); else drawSpectrum();
    if (x == null) return;
    const c = chart.canvas.getContext("2d");
    c.strokeStyle = css("--pd-muted");
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(Math.round(x) + 0.5, 8);
    c.lineTo(Math.round(x) + 0.5, chart.height - 24);
    c.stroke();
    c.setLineDash([]);
  }

  function foldTip(chart, px) {
    const { g, xs, series } = chart.geom;
    if (px < g.x0 || px > g.x1) return null;
    const i = Math.round(((px - g.x0) / (g.x1 - g.x0)) * (xs.length - 1));
    const off = xs[i];
    const rows = series.map(([name, s, col]) => `<i style="background:${css(col)}"></i>${name}: <b>${s[i].toFixed(1)} dB</b>`).join("<br>");
    const where = off === 0 ? "justo en un múltiplo de 600 Hz" : `${off > 0 ? "+" : "−"}${Math.abs(off)} Hz de un múltiplo de 600 Hz`;
    return { x: g.x(off), y: g.y0 + 20, html: `${where}<br>${rows}` };
  }

  function specTip(chart, px) {
    const { panels, geoms, f0, f1 } = chart.geom;
    const g = geoms[0];
    if (px < g.x0 || px > g.x1) return null;
    const f = Math.round(f0 + ((px - g.x0) / (g.x1 - g.x0)) * (f1 - f0));
    const near = Math.round(f / 600) * 600;
    const rows = panels.map(([name, s, col]) => `<i style="background:${css(col)}"></i>${name}: <b>${(s[f] || 0).toFixed(1)} dB</b>`).join("<br>");
    const mark = Math.abs(f - near) <= 2 ? ` · múltiplo de 600 Hz (${near / 600}×)` : "";
    return { x: g.x(f), y: g.y0 + 20, html: `${f.toLocaleString("es-MX")} Hz${mark}<br>${rows}` };
  }

  // ---------------------------------------------------------------- boot
  root.innerHTML = '<p class="fp-loading">Cargando datos…</p>';
  fetch(`${base}data.json`)
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((d) => {
      data = d;
      build();
      renderPlay();
      renderAll();
      new ResizeObserver(() => { drawFold(); drawSpectrum(); }).observe(root);
      // Redraw on theme changes: MkDocs toggles an attribute, plain pages follow the OS.
      const retheme = () => { renderTiles(); drawFold(); drawSpectrum(); };
      new MutationObserver(retheme)
        .observe(document.body, { attributes: true, attributeFilter: ["data-md-color-scheme"] });
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);
    })
    .catch((err) => {
      root.innerHTML = `<p class="fp-loading">No se pudieron cargar los datos del panel (${err.message}).</p>`;
    });
})();
