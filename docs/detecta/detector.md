---
title: Un detector en PyTorch
---

<p class="pd-kicker">03 · Cómo se detecta</p>

# Un detector binario en PyTorch

La intuición detrás de un detector de música IA es bastante simple. Partimos de un conjunto de
datos: un montón de canciones hechas por personas y un montón de canciones hechas con IA. De
cada canción sacamos su espectrograma, y esas "imágenes" las pasamos por una red neuronal, un
**clasificador**, cuyo objetivo es aprender las características de cada grupo para poder
separarlos. Al final nos da un *score*: 0 significa humano y 1 significa inteligencia artificial.

Este método es justo el que usaron en Deezer en uno de los primeros papers sobre el tema
([Afchar et al., ICASSP 2025](https://arxiv.org/abs/2501.10111)), que de alguna forma fundó el
campo de la detección de música generada por IA. Aquí vamos a construir una versión pequeña que
corre en una laptop en un par de minutos. El script completo está en
[`examples/03_detector_pytorch.py`](https://github.com/fergarciadlc/pyday26-ai-music-detection/blob/main/examples/03_detector_pytorch.py).

## El truco: datos sintéticos

No necesitamos descargar miles de canciones de Suno. Basta con tomar música real y pasarla por
un codec neuronal, como hicimos en [Cómo se genera](../genera.md): **la música es la misma, solo
cambian las marcas que deja el decoder**. Si el modelo aprende a separarlas, sabemos que está
mirando las marcas y no la música.

```python
--8<-- "examples/03_detector_pytorch.py:codec"
```

## Del audio a ventanas de espectrograma

Cortamos cada canción en ventanas de 2.5 segundos y calculamos el espectrograma de cada una,
igual que en la [página anterior](espectrogramas.md).

```python
--8<-- "examples/03_detector_pytorch.py:features"
```

Como canciones reales usamos [MUSDB18](https://sigsep.github.io/datasets/musdb.html) en su
versión gratuita de 7 segundos por canción (144 canciones). Separamos entrenamiento y prueba
**por canción**: si una canción aparece en las dos partes, el modelo podría simplemente
recordarla.

```python
--8<-- "examples/03_detector_pytorch.py:datos"
```

## El modelo: una CNN

Es una **red neuronal convolucional** (CNN), un tipo de modelo muy usado para clasificar
imágenes. Sin entrar en muchos detalles: tiene bloques de convolución que van reduciendo la
imagen, luego un promedio global y al final una capa que nos dice si el audio es humano o pasó
por el decoder. Es la misma estructura que vimos en la charla.

```python
--8<-- "examples/03_detector_pytorch.py:modelo"
```

## Entrenamiento

El loop de entrenamiento de PyTorch de toda la vida: revolvemos los ejemplos, calculamos la
pérdida, propagamos el error hacia atrás y actualizamos los pesos.

```python
--8<-- "examples/03_detector_pytorch.py:entrenamiento"
```

<div class="pd-band" markdown>

<div class="pd-glass-grid">
  <div class="pd-glass"><b class="pd-big">100%</b>de acierto en las canciones de prueba, desde la primera época de entrenamiento.</div>
  <div class="pd-glass"><b class="pd-big">94 / 50</b>canciones de entrenamiento y de prueba (752 y 400 ventanas).</div>
  <div class="pd-glass"><b class="pd-big">~2.5 min</b>para entrenar todo en una laptop (MacBook, GPU de Apple).</div>
</div>

</div>

Predicciones casi perfectas. Entonces, el problema está resuelto, ¿no?

## ¿Problema resuelto?

La verdad es que no. Probemos el detector con audio que nunca vio: mi grabación de guitarra (y su
versión de EnCodec) y los clips de Suno del [experimento del inicio](../quiz.md).

```python
--8<-- "examples/03_detector_pytorch.py:nuevos"
```

| Audio | Qué es | Probabilidad de "IA" | ¿Acertó? |
|---|---|---|---|
| Mi guitarra | Humana | 0.00 | :material-check: |
| Mi guitarra + EnCodec | Pasó por el decoder que conoce | 0.98 | :material-check: |
| Clip 3 | IA (Suno) | 0.00 | :material-close: |
| Clip 4 | Híbrida (mi guitarra + base de Suno) | 0.00 | :material-close: |
| Clip 5 | IA (Suno) | 0.00 | :material-close: |

El detector reconoce perfecto el decoder que conoce, pero:

- **No generaliza.** Solo vio EnCodec, y los clips de Suno los da por humanos con total
  seguridad. Cada plataforma tiene su propio decoder y su propia huella, así que cada generador
  nuevo exige volver a entrenar el detector. Y conforme la detección mejora, las plataformas
  pueden hacer que sus modelos dejen menos huellas: es una carrera armamentista.
- **Es frágil ante transformaciones.** Cambiar el tono o recomprimir el audio puede borrar parte
  de la huella, y el detector deja de reconocerla.
- **Solo sabe decir sí o no.** Para el clip híbrido no hay respuesta correcta en un sistema
  binario. La pregunta interesante es **cuánta IA** tiene esa canción, y de eso trata
  [mi investigación](https://arxiv.org/abs/2608.07285).

!!! note "¿Qué está aprendiendo el modelo?"
    Con este tipo de entrenamiento no podemos estar 100% seguros sin un análisis exhaustivo del
    modelo por dentro (eso es toda una rama de la IA, la *interpretabilidad*). Pero todo apunta a
    que está reconociendo las marcas del decoder: los **fakeprints**.

[Siguiente: fakeprints :material-arrow-right:](fakeprints.md){ .md-button .md-button--primary }
