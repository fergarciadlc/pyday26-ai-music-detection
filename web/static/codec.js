// Interactive codec diagram in the style of the slides (13–15):
// three views (codec, generation, inside the decoder), hover captions,
// and it follows the clip chosen in the players below ("pd:select" events).
(function () {
  const root = document.getElementById("codec-diagram");
  if (!root) return;

  const NS = "http://www.w3.org/2000/svg";
  const CY = 150;
  const INFO = {
    in: "El audio original: una lista larguísima de números, 24,000 por segundo.",
    enc: "El encoder comprime el audio en muchos menos números.",
    lat: "Latentes: una representación compacta del audio. 128 números, 75 veces por segundo.",
    codes: "El cuantizador (RVQ) cambia cada latente por unos pocos índices de un diccionario: los códigos ẑ. El archivo queda 128 veces más chico.",
    dec: "El decoder convierte los latentes en audio con capas de upsampling. Siempre está al final, sin importar el modelo.",
    out: "El audio que sale del decoder: reconstruido o completamente nuevo.",
    gen: "Un modelo generativo (transformers, difusión, redes adversarias…) inventa latentes nuevos. El encoder ya no hace falta.",
    up: "Cada capa de upsampling multiplica la tasa de muestreo (×8, ×5, ×4, ×2) y deja picos en frecuencias fijas: los fakeprints.",
  };
  const DEFAULT = {
    codec: "Un codec neuronal es un autoencoder: comprime el audio y lo reconstruye. Pasa el cursor por cada parte.",
    gen: "Para generar música nueva, un modelo inventa los latentes y el decoder los convierte en audio.",
    decoder: "Dentro del decoder: el upsampling sube la tasa de muestreo paso a paso y deja pequeños artefactos periódicos.",
  };

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.append(n);
    return n;
  };
  const text = (x, y, str, cls, parent) => {
    const t = el("text", { x, y, class: cls }, parent);
    t.textContent = str;
    return t;
  };
  function wave(parent, x0, w, values, cls) {
    const g = el("g", { class: cls }, parent);
    const bw = w / values.length;
    let d = "";
    values.forEach((v, i) => {
      const h = Math.max(1.5, v * 62);
      d += `M${(x0 + i * bw + bw / 2).toFixed(1)} ${CY - h}V${CY + h}`;
    });
    el("path", { d, class: "wv" }, g);
    return g;
  }
  // A waveform that can show playback progress: a lit copy clipped to the played part.
  let clipId = 0;
  function pwave(parent, x0, w, values) {
    parent.replaceChildren();
    const g = wave(parent, x0, w, values, "pw");
    const id = `dg-clip-${++clipId}`;
    const r = el("rect", { x: x0, y: 0, width: 0, height: 300 }, el("clipPath", { id }, defs));
    const lit = g.firstChild.cloneNode();
    lit.setAttribute("class", "wv wv-lit");
    lit.setAttribute("clip-path", `url(#${id})`);
    g.append(lit);
    const head = el("line", { x1: x0, x2: x0, y1: CY - 72, y2: CY + 72, class: "whead" }, g);
    return {
      set(p) {
        r.setAttribute("width", (w * p).toFixed(1));
        head.setAttribute("x1", x0 + w * p);
        head.setAttribute("x2", x0 + w * p);
      },
    };
  }
  function stack(parent, x, n, w, h, gap, cls) {
    const g = el("g", { class: cls }, parent);
    const total = n * h + (n - 1) * gap;
    for (let i = 0; i < n; i++) el("rect", { x, y: CY - total / 2 + i * (h + gap), width: w, height: h, rx: 4 }, g);
    return g;
  }
  const part = (g, key) => { g.dataset.part = key; g.classList.add("part"); return g; };

  // ---------------------------------------------------------------- layout
  root.innerHTML = `
    <div class="dg-tabs" role="tablist" aria-label="Vista del diagrama">
      <button role="tab" data-mode="codec" aria-selected="true">Codec</button>
      <button role="tab" data-mode="gen" aria-selected="false">Generación</button>
      <button role="tab" data-mode="decoder" aria-selected="false">Dentro del decoder</button>
    </div>`;
  const svg = el("svg", { viewBox: "4 34 890 234", class: "dg", "data-mode": "codec", role: "img",
    "aria-label": "Diagrama de un codec neuronal: encoder, latentes, códigos, decoder; y la versión generativa." }, root);
  const caption = document.createElement("p");
  caption.className = "dg-caption";
  caption.setAttribute("aria-live", "polite");
  root.append(caption);

  const defs = el("defs", {}, svg);
  const mk = el("marker", { id: "dg-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
  el("path", { d: "M0 0L10 5L0 10z", fill: "#1d2550" }, mk);

  el("path", { d: `M20 ${CY}H870`, class: "flow" }, svg);

  // Codec-only: input, encoder, first latents, encoder projection.
  const codecOnly = el("g", { class: "only-codec" }, svg);
  const inG = part(el("g", {}, codecOnly), "in");
  const inWaveHolder = el("g", {}, inG);
  text(85, 62, "x", "sym", inG);
  const encG = part(el("g", {}, codecOnly), "enc");
  el("polygon", { points: "175,55 320,105 320,195 175,245", class: "enc" }, encG);
  text(247, 155, "Encoder", "lbl", encG);
  part(stack(codecOnly, 336, 4, 24, 26, 4, "lat"), "lat");
  el("polygon", { points: "372,110 396,126 396,174 372,190", class: "enc" }, codecOnly);

  // Generation-only: the generative model and its arrow.
  const genOnly = el("g", { class: "only-gen" }, svg);
  const genG = part(el("g", {}, genOnly), "gen");
  el("rect", { x: 20, y: 92, width: 330, height: 116, rx: 16, class: "genbox" }, genG);
  const genTitle = text(185, 145, "Modelo generativo", "gtitle", genG);
  const genSub = text(185, 172, "Transformers · Difusión · Adversario", "gsub", genG);
  el("path", { d: `M352 ${CY}H402`, class: "arrow", "marker-end": "url(#dg-arrow)" }, genOnly);

  // Shared: codes, decoder projection, latents, decoder, output.
  const shared = el("g", { class: "shared" }, svg);
  const codesG = part(stack(shared, 410, 4, 24, 24, 4, "codes"), "codes");
  text(422, 64, "Q", "sym", codesG);
  text(422, 80, "RVQ", "tiny", codesG);
  text(422, 238, "ẑ", "sym", codesG);
  el("polygon", { points: "450,126 474,110 474,190 450,174", class: "decp" }, shared);
  part(stack(shared, 488, 4, 24, 26, 4, "lat"), "lat");
  const decG = part(el("g", { class: "decg" }, shared), "dec");
  el("polygon", { points: "528,105 528,195 680,245 680,55", class: "dec" }, decG);
  text(604, 155, "Decoder", "lbl", decG);
  const outG = part(el("g", {}, shared), "out");
  const outWaveHolder = el("g", {}, outG);
  text(782, 62, "x̂", "sym", outG);

  // Decoder-only: the inside view (slide 15), drawn on 30–970 and scaled into the
  // same frame as the other views.
  const decOuter = part(el("g", { class: "only-decoder" }, svg), "up");
  const decOnly = el("g", { transform: "translate(-12.8 11.2) scale(0.9255)" }, decOuter);
  el("polygon", { points: "30,62 970,30 970,270 30,238", class: "dec dec-big" }, decOnly);
  text(46, 46, "Decoder", "lbl lbl-left", decOnly);
  stack(decOnly, 52, 4, 26, 24, 4, "codes");
  text(65, 222, "ẑ", "sym", decOnly);
  // Latent rate 75 Hz → ×8 → ×5 → ×4 → ×2 → 24 kHz; the boxes grow with each layer.
  const stages = [[96, "×8", 6, 14, 11], [216, "×5", 9, 11, 8], [336, "×4", 12, 9, 5]];
  stages.forEach(([x, f, n, w, h]) => {
    el("path", { d: `M${x} ${CY}H${x + 52}`, class: "arrow", "marker-end": "url(#dg-arrow)" }, decOnly);
    text(x + 26, CY - 14, f, "tiny", decOnly);
    stack(decOnly, x + 66, n, w, h, 3, "box-sm");
  });
  el("path", { d: `M456 ${CY}H508`, class: "arrow", "marker-end": "url(#dg-arrow)" }, decOnly);
  text(482, CY - 14, "×2", "tiny", decOnly);
  text(300, 236, "upsampling", "tiny", decOnly);
  const bigWaveHolder = el("g", {}, decOnly);
  const artifacts = el("g", { class: "artifacts" }, decOnly);
  for (let x = 540; x <= 940; x += 36) el("line", { x1: x, y1: 74, x2: x, y2: 222 }, artifacts);
  text(740, 240, "artefactos del upsampling", "tiny art-lbl", decOnly);

  // ---------------------------------------------------------------- behaviour
  let mode = "codec";
  const tabs = root.querySelectorAll(".dg-tabs button");
  function setMode(m) {
    mode = m;
    svg.dataset.mode = m;
    tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
    caption.textContent = DEFAULT[m];
  }
  tabs.forEach((b) => b.addEventListener("click", () => { resetGen(); setMode(b.dataset.mode); }));

  svg.querySelectorAll(".part").forEach((p) => {
    p.addEventListener("pointerenter", () => { p.classList.add("hover"); caption.textContent = INFO[p.dataset.part]; });
    p.addEventListener("pointerleave", () => { p.classList.remove("hover"); caption.textContent = DEFAULT[mode]; });
  });

  function resetGen() {
    genTitle.textContent = "Modelo generativo";
    genSub.textContent = "Transformers · Difusión · Adversario";
    svg.classList.remove("focus-in");
  }

  // Follow the players: show the path that produced the selected clip, and draw the
  // clip itself where it lives in the diagram (input x for the original, output x̂ otherwise).
  let inW = null;
  let outW = null;
  let target = null;
  document.addEventListener("pd:select", (e) => {
    const { name, mode: m, gen, playing, wave: w } = e.detail;
    resetGen();
    if (gen) { genTitle.textContent = gen[0]; genSub.textContent = gen[1]; }
    const isInput = name === "original";
    svg.classList.toggle("focus-in", isInput);
    if (w && !isInput) outW = pwave(outWaveHolder, 705, 150, w);
    target = isInput ? inW : outW;
    inG.classList.toggle("active", isInput);
    outG.classList.toggle("active", !isInput);
    svg.classList.add("has-clip");
    setMode(m);
    svg.classList.toggle("is-playing", !!playing);
  });
  document.addEventListener("pd:progress", (e) => target && target.set(e.detail.p));
  document.addEventListener("pd:stop", () => svg.classList.remove("is-playing"));

  fetch(root.dataset.media)
    .then((r) => r.json())
    .then((media) => {
      inW = pwave(inWaveHolder, 20, 130, media.original.wave);
      outW = pwave(outWaveHolder, 705, 150, media.reconstruccion.wave);
      const big = [];
      for (let i = 0; i < 2; i++) big.push(...media.reconstruccion.wave);
      wave(bigWaveHolder, 528, 420, big.slice(0, 150), "w-out");
    })
    .catch(() => {
      inW = pwave(inWaveHolder, 20, 130, new Array(96).fill(0.3));
      outW = pwave(outWaveHolder, 705, 150, new Array(96).fill(0.3));
    });

  setMode("codec");
})();
