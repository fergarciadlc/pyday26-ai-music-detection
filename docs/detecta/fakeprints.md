---
title: Fakeprints
---

<p class="pd-kicker">03 · Cómo se detecta</p>

# Fakeprints: la huella del decoder

Si el detector no está escuchando la música, ¿qué está viendo? Todo apunta a los
**fakeprints**: los pequeños errores o artefactos que deja el decoder al final de la generación.

La idea viene prestada otra vez de la visión por computadora. Algunos modelos que generaban
imágenes, si los veías de cerca, dejaban un patrón que parecía un tablero de ajedrez
([Odena et al., 2016](https://distill.pub/2016/deconv-checkerboard/)). En audio pasa algo
parecido: el decoder sube la tasa de muestreo paso a paso con capas de *upsampling*, y esas capas
dejan **picos en frecuencias fijas** que aparecen en el audio generado y no en el humano. No
dependen de la música, sino de la arquitectura del decoder
([Afchar et al., ISMIR 2025](https://arxiv.org/abs/2506.19108)).

## Una guitarra antes y después de EnCodec

Para verlo grabé unos segundos de guitarra y los pasé por
[EnCodec](https://huggingface.co/facebook/encodec_24khz) a varios bitrates. Dale play y cambia
entre **Original** y **EnCodec** mientras suena: el audio sigue en el mismo punto. **Diferencia**
reproduce solo lo que el codec cambió.

<div id="fp-panel" data-base="../../assets/fakeprints/"></div>

## ¿Qué estamos viendo?

En los espectrogramas el original y la versión de EnCodec se ven casi iguales, y suenan casi
iguales. Los picos son muy finos y no cambian en el tiempo, así que se esconden entre las notas
de la guitarra. Para encontrarlos hacemos dos cosas:

1. **Promediamos todo el audio** con muchísima resolución (1 Hz) y nos quedamos solo con los
   picos que sobresalen. Es la segunda gráfica: ahí se ven las notas de la guitarra en los dos
   audios, y en el de EnCodec además aparecen picos que caen en la rejilla amarilla.
2. **Doblamos el espectro cada 600 Hz**: cortamos el espectro en pedazos de 600 Hz y los ponemos
   uno encima del otro. Las notas de la guitarra caen en lugares distintos de cada pedazo y se
   promedian; los picos del decoder caen siempre en el mismo lugar y se suman. Es la primera
   gráfica, y por eso el pico rosa aparece justo en el centro.

¿Te acuerdas del experimento de [latentes en cero](../genera.md#6-latentes-inventados)? Ese
zumbido constante es exactamente esto: los picos del decoder, sin música encima.

## ¿Por qué cada 600 Hz?

El decoder de EnCodec parte de 75 latentes por segundo y llega a 24,000 muestras por segundo con
cuatro capas de upsampling, que multiplican por 8, 5, 4 y 2. Cada capa trabaja a una velocidad
distinta y deja picos en los múltiplos de esa velocidad:

| Capa (desde la salida) | Multiplica por | Trabaja a | Deja picos cada |
|---|---|---|---|
| Última | ×2 | 12,000 Hz | 12 kHz (el borde del espectro) |
| Penúltima | ×4 | 3,000 Hz | 3 kHz |
| Antepenúltima | ×5 | 600 Hz | **600 Hz** |
| Primera | ×8 | 75 Hz | 75 Hz |

Otro codec, con otros factores, deja picos en otras frecuencias. Por eso un detector entrenado
con un decoder no necesariamente reconoce a otro, como vimos con
[los clips de Suno](detector.md#problema-resuelto). Entender por qué aparecen estos picos requiere
saber de audio, no solo de machine learning.

## Cómo se calculó

Todo sale de
[`scripts/build_fakeprints.py`](https://github.com/fergarciadlc/pyday26-ai-music-detection/blob/main/scripts/build_fakeprints.py).
La parte central son tres pasos con NumPy y librosa:

```python
import librosa
import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 24_000
y, _ = librosa.load("guitar.mp3", sr=SR)

# 1. Espectro promedio con resolución de 1 Hz (n_fft = SR)
S = np.abs(librosa.stft(y, n_fft=SR, hop_length=SR // 4))
espectro = 20 * np.log10(S.mean(axis=1) + 1e-10)

# 2. Quitamos la forma general del espectro: quedan solo los picos
picos = np.clip(espectro - uniform_filter1d(minimum_filter1d(espectro, 201), 201), 0, None)

# 3. "Doblamos" el espectro cada 600 Hz y promediamos
f = np.arange(len(picos))
banda = (f >= 2_000) & (f <= 11_500)
posicion = ((f + 300) % 600)[banda]
doblado = np.bincount(posicion, picos[banda], 600) / np.bincount(posicion, minlength=600)
```

Para hacerlo con tu propio audio:

```bash
uv run --group audio scripts/build_fakeprints.py tu_audio.wav
```

Estos resultados son de una sola grabación, para ilustrar la idea. Afchar et al. estudian el
fenómeno a fondo, con muchos codecs y muchas canciones, en
[*A Fourier Explanation of AI-music Artifacts*](https://arxiv.org/abs/2506.19108) (ISMIR 2025).
