"""Turn the ISMIR 2026 architecture diagram into the talk's binary-only CNN diagram.

Source: the project page of "How Much AI Is in This Track?" (same author), whose
diagram shows a shared backbone with a binary and a regression head. Here we keep
only the binary detector, translate the labels to Spanish and use PyDay colours.

Usage:
    uv run scripts/build_cnn_diagram.py \
        ../ismir26-how-much-ai/assets/diagrams/architecture.svg web/static/cnn.svg
"""

import re
import sys
from pathlib import Path

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
svg = src.read_text()

TEXT = {
    ">Input<": ">Entrada<",
    ">Magnitude STFT<": ">Espectrograma (STFT)<",
    ">2048 win · 512 hop<": ">ventana 2048 · hop 512<",
    ">Conv backbone · 6 blocks<": ">6 bloques convolucionales<",
    ">filters double each block<": ">los filtros se duplican en cada bloque<",
    ">Global avg. pool<": ">Promedio global<",
    ">Dense · 128 units<": ">Capa densa · 128<",
}
for a, b in TEXT.items():
    assert svg.count(a) == 1, a
    svg = svg.replace(a, b)

# Wider pills for the longer Spanish labels (x, width).
svg = svg.replace('<rect x="342.0" y="15" width="196"', '<rect x="330.0" y="15" width="220"')
svg = svg.replace('<rect x="748.0" y="15" width="140"', '<rect x="753.0" y="15" width="130"')
svg = svg.replace('<rect x="682.0" y="307" width="130"', '<rect x="687.0" y="307" width="120"')

# Drop the regression head: its node, labels, edges and the two braces.
svg = re.sub(r'<circle class="reg"[^>]*/>', "", svg)
svg = re.sub(r'<text class="head reg".*?\n', "", svg)
svg = re.sub(r'<text class="hl" x="930" y="240">.*?\n', "", svg)
svg = re.sub(r'<line[^>]*stroke="#9fbde0"[^>]*/>\n?', "", svg)
svg = re.sub(r'<path class="br".*?\n', "", svg)

# Centre the binary output on the dense layer and relabel it.
svg = svg.replace('x2="885" y2="148" stroke="#e7a1ad"', 'x2="885" y2="193" stroke="#f39ac4"')
svg = svg.replace(
    '<circle class="bin" cx="900" cy="148" r="16"/>',
    '<circle class="bin" cx="900" cy="193" r="16"/>',
)
svg = re.sub(
    r'<text class="head bin" x="930" y="118">Binary detector</text>\n'
    r'<text class="hl" x="930" y="140">sigmoid · BCE</text>'
    r'<text class="hl" x="930" y="160">labels \{0, 1\}</text>'
    r'<text class="hs" x="930" y="180">on FMA \+ EnCodec</text>',
    '<text class="head bin" x="930" y="168">Probabilidad de IA</text>\n'
    '<text class="hl" x="930" y="192">sigmoide · BCE</text>'
    '<text class="hl" x="930" y="213">0 = humano · 1 = IA</text>'
    '<text class="hs" x="930" y="234">real vs. EnCodec</text>',
    svg,
)
assert "Probabilidad de IA" in svg and "Regression" not in svg and "#9fbde0" not in svg

# PyDay magenta instead of the paper's red; trim the empty bottom.
svg = svg.replace("--binary,#c43c52", "--binary,#d6246e").replace(
    'stroke="#c43c52"', 'stroke="#d6246e"'
)
svg = svg.replace('viewBox="0 0 1180 400"', 'viewBox="0 0 1180 345"')
svg = re.sub(
    r"<title id=\"archT\">.*?</title>",
    '<title id="archT">Arquitectura del detector binario</title>',
    svg,
)
svg = re.sub(
    r'<desc id="archD">.*?</desc>',
    # The page is in Spanish, so the diagram's accessible description is too.
    '<desc id="archD">Un espectrograma (STFT con ventana de 2048 y hop de 512) pasa por '
    "seis bloques convolucionales cuyos filtros se duplican de 16 a 512, luego por un "
    "promedio global y una capa densa de 128 unidades. Una sigmoide entrenada con entropía "
    "cruzada binaria da la probabilidad de que el audio sea IA: 0 humano, 1 IA.</desc>",
    svg,
    flags=re.S,
)

dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(svg)
print(f"{dst}: {len(svg) / 1024:.0f} KB")
