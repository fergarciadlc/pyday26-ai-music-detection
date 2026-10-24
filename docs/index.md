---
title: Inicio
hide:
  - navigation
  - toc
---

<div class="pd-hero" markdown>

<div markdown>

<img class="pd-wordmark" src="assets/brand/pyday-wordmark.png" alt="PyDay México 2026">

# ¿Suena a IA?

<p class="pd-lead">Detección de música generada por inteligencia artificial</p>

<p class="pd-author"><strong>Fernando Garcia de la Cruz</strong> · Research engineer en machine learning y procesamiento digital de señales para audio y música</p>

[Escuchar el experimento](quiz.md){ .md-button .md-button--primary }
[Ver el código](genera.md){ .md-button }
[Slides (PDF)](assets/slides/pyday26mx-ai-music-detection.pdf){ .md-button }

</div>

<img class="pd-logo" src="assets/brand/pyday-logo.png" alt="">

</div>

Hola, soy Fernando. Esta es la web que acompaña mi charla en PyDay México 2026. Aquí
está todo lo que platicamos, pero con más calma: los audios del experimento del inicio,
el código para que lo pruebes tú mismo y las referencias por si quieres profundizar.

Un poco sobre mí: estudié en el Instituto Politécnico Nacional, en la Ciudad de México, y
después de unos años trabajando hice una maestría en Sound and Music Computing en Barcelona.
He trabajado en Sony CSL, en Dolby y en Ear Candy Technologies, una de las primeras empresas
en hacer plugins de audio en México. Durante la maestría investigué sobre detección de música
generada por IA, y de ahí salieron dos artículos en ISMIR 2026.

Además soy músico, así que tengo sentimientos encontrados con el tema. Como ingeniero, me parece
que la tecnología es impresionante y abre muchísimas posibilidades creativas. Como músico, entiendo
perfectamente por qué a muchos artistas les preocupa lo que está pasando en la industria.

## Algunos números

<div class="pd-band" markdown>

<div class="pd-glass-grid">
  <div class="pd-glass"><b class="pd-big">10% → 50%+</b>de las canciones que se suben a Deezer cada día son 100% IA: 10% en enero de 2025, más de la mitad en los días pico de 2026.</div>
  <div class="pd-glass"><b class="pd-big">90,000</b>canciones generadas con IA al día, en junio de 2026.</div>
  <div class="pd-glass"><b class="pd-big">1 a 3%</b>de las reproducciones. Es decir: hay mucho volumen, pero casi nadie lo escucha.</div>
</div>

<p class="pd-source">Fuente: Deezer Newsroom (enero 2025 – julio 2026). Más detalles en <a href="recursos/" style="color:#fff">Recursos</a>.</p>

</div>

## La charla en cuatro partes

<div class="grid cards pd-two" markdown>

-   **01 · Contexto actual**

    ---

    Casi nadie distingue la música generada por IA con solo escucharla, pero a casi todos
    les importa saber qué están escuchando. Hay demandas contra Suno y Udio, una ley en la
    Unión Europea que obliga a marcar el audio generado y casos de fraude con regalías.

    [:material-headphones: Escucha el experimento](quiz.md)

-   **02 · Cómo se genera música con IA**

    ---

    Muchos modelos generativos funcionan alrededor de un **codec neuronal**: algo parecido a
    un MP3, pero hecho con redes neuronales. No importa la arquitectura, al final todo pasa
    por un **decoder**, y el decoder deja pequeñas marcas en el audio.

    [:material-code-braces: Abre un codec con Python](genera.md)

-   **03 · Cómo se detecta**

    ---

    Convertimos el audio en una imagen (un espectrograma) y entrenamos una red neuronal que
    aprenda a separar música humana de música generada. Funciona casi perfecto… hasta que
    deja de funcionar.

    [:material-chart-bell-curve: Espectrogramas](detecta/espectrogramas.md) ·
    [:material-brain: Un detector en PyTorch](detecta/detector.md) ·
    [:material-sine-wave: Fakeprints](detecta/fakeprints.md)

-   **04 · Contenido híbrido**

    ---

    Hoy muchas canciones combinan pistas grabadas por personas con pistas generadas. Para
    esas, un "sí o no" ya no alcanza: la pregunta es **¿cuánta IA hay en esta canción?**
    De eso trata mi investigación.

    [:material-file-document: Lee el paper (ISMIR 2026)](https://arxiv.org/abs/2608.07285)

</div>

## Para llevar

<div class="pd-band" markdown>

<div class="pd-glass-grid">
  <div class="pd-glass"><span class="pd-n">1</span>El oído humano ya casi no puede distinguir la música generada por IA de la música hecha por personas.</div>
  <div class="pd-glass"><span class="pd-n">2</span>Podemos entrenar modelos de IA que detectan contenido hecho por IA, generalmente viendo las pequeñas marcas que dejan en el audio. Pero son frágiles.</div>
  <div class="pd-glass"><span class="pd-n">3</span>Decir solo "sí o no" ya no es suficiente: no representa cómo se está haciendo música hoy, combinada con IA.</div>
</div>

</div>
