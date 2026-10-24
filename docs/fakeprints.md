---
title: Fakeprints
---

# Fakeprints: la huella del decoder

Casi todos los generadores de música modernos producen **latentes** de un codec neuronal
de audio, y un **decoder** los convierte en sonido. El decoder sube la tasa de muestreo
paso a paso con capas de *upsampling*, y esas capas dejan un patrón periódico en la señal:
picos en frecuencias fijas que no dependen de la música, sino de la arquitectura. Es el
equivalente en audio del patrón de tablero en imágenes (Odena et al., 2016), y es lo que
aprenden los detectores binarios (Afchar et al., 2025).

Para verlo sin entrenar ningún generador basta con pasar una grabación real por un codec:
la música es la misma, solo cambian los artefactos del decoder.

## Una guitarra antes y después de EnCodec

Grabé unos segundos de guitarra y los pasé por
[EnCodec 24 kHz](https://huggingface.co/facebook/encodec_24khz) (encode → decode) a varios
bitrates. Dale play y cambia entre **Original** y **EnCodec**: el audio sigue en el mismo
punto. La opción **Diferencia** reproduce lo que el codec cambió.

<div id="fp-panel" data-base="../assets/fakeprints/"></div>

## ¿Por qué cada 600 Hz?

El decoder de EnCodec parte de 75 latentes por segundo y llega a 24,000 muestras por
segundo con cuatro capas de upsampling de factores 8, 5, 4 y 2. Cada capa trabaja a una
tasa distinta y deja picos en los múltiplos de esa tasa:

| Capa (desde la salida) | Factor | Tasa a la que trabaja | Picos cada |
|---|---|---|---|
| Última | ×2 | 12,000 Hz | 12 kHz (el borde del espectro) |
| Penúltima | ×4 | 3,000 Hz | 3 kHz |
| Antepenúltima | ×5 | 600 Hz | **600 Hz** |
| Primera | ×8 | 75 Hz | 75 Hz |

Por eso el peine de 600 Hz es tan claro: es la huella de una capa concreta de este decoder.
Otro codec, con otros factores, deja picos en otras frecuencias, y un detector entrenado
con uno no necesariamente reconoce al otro.

!!! note "Por qué el espectrograma no basta"
    En los espectrogramas de arriba el original y la versión de EnCodec se ven casi
    iguales, y suenan casi iguales. Los picos solo aparecen al **promediar todo el audio**
    con una resolución de 1 Hz: son finos, constantes en el tiempo y quedan escondidos
    entre los parciales de la guitarra. Por eso los detectores ven lo que nosotros no oímos.

## Cómo se calculó

Todo sale de [`scripts/build_fakeprints.py`](https://github.com/fergarciadlc/pyday26-ai-music-detection/blob/main/scripts/build_fakeprints.py).
La parte central son tres pasos con NumPy y librosa:

```python
import librosa
import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 24_000
y, _ = librosa.load("guitar.mp3", sr=SR)

# 1. Espectro promedio con resolución de 1 Hz (n_fft = SR)
S = np.abs(librosa.stft(y, n_fft=SR, hop_length=SR // 4))
mean_db = 20 * np.log10(S.mean(axis=1) + 1e-10)

# 2. Quitar la envolvente: quedan solo los picos estrechos
envelope = uniform_filter1d(minimum_filter1d(mean_db, 201), 201)
residual = np.clip(mean_db - envelope, 0, None)

# 3. "Doblar" el espectro cada 600 Hz y promediar
f = np.arange(len(residual))
band = (f >= 2_000) & (f <= 11_500)
offset = ((f + 300) % 600)[band]
folded = np.bincount(offset, residual[band], 600) / np.bincount(offset, minlength=600)
```

Para reproducirlo con tu propio audio:

```bash
uv run --group audio scripts/build_fakeprints.py tu_audio.wav
```

Los resultados son de una sola grabación, para ilustrar la idea. Afchar et al. estudian
el fenómeno a fondo, con muchos codecs y muchas canciones, en
[*A Fourier Explanation of AI-music Artifacts*](https://arxiv.org/abs/2506.19108) (ISMIR 2025).
