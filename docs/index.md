---
title: Inicio
hide:
  - navigation
  - toc
---

<div class="pd-hero" markdown>

<p class="pd-kicker">PyDay México 2026</p>

# ¿Suena a IA?

<p class="pd-lead">Detección de música generada por inteligencia artificial</p>

<p class="pd-author"><strong>Fernando García de la Cruz</strong> · Research engineer en machine learning y procesamiento de señales para audio y música</p>

[Escuchar el quiz](quiz.md){ .md-button .md-button--primary }
[Ver los fakeprints](fakeprints.md){ .md-button }
[Slides (PDF)](assets/slides/pyday26mx-ai-music-detection.pdf){ .md-button }

</div>

Esta es la web que acompaña la charla. Aquí puedes volver a escuchar el quiz del inicio,
ver y escuchar cómo un codec neuronal deja su "huella" en el audio, y encontrar los papers,
datos y repositorios que se mencionan en las slides.

## La charla en cuatro partes

<div class="grid cards pd-two" markdown>

-   **01 · Contexto actual**

    ---

    En Deezer, la música generada por IA pasó de un 10% de las subidas diarias en enero
    de 2025 a más de la mitad en los días pico de 2026; en 2025, hasta el 85% de sus
    reproducciones fueron fraudulentas.
    Demandas contra Suno y Udio, el AI Act de la UE y fraude en regalías explican por qué
    importa detectarla.

-   **02 · Cómo se genera música con IA**

    ---

    Los generadores modernos trabajan sobre los latentes de un **codec neuronal**. Da igual
    el modelo generativo: el audio final siempre pasa por el **decoder**, y sus capas de
    upsampling dejan artefactos.

-   **03 · Cómo se detecta**

    ---

    Si tratamos el espectrograma como una imagen, la detección es un problema de visión
    por computadora. Una CNN binaria llega al 99.97% en canciones completas aprendiendo
    los *fakeprints* del decoder… pero es frágil ante transformaciones, otros generadores
    y contenido híbrido.

-   **04 · Contenido híbrido**

    ---

    De "¿es IA?" a "¿cuánta IA?": cuando solo algunos stems son generados, una etiqueta
    0/1 no alcanza. Mi investigación propone estimar α, la fracción de energía que aportan
    los stems IA.

</div>

## Explora

<div class="grid cards" markdown>

-   :material-headphones: **[¿Cuál es IA?](quiz.md)**

    Los seis clips del inicio de la charla, con sus respuestas.

-   :material-sine-wave: **[Fakeprints](fakeprints.md)**

    Una grabación de guitarra antes y después de EnCodec: escúchala y mira la huella del decoder.

-   :material-book-open-variant: **[Recursos](recursos.md)**

    Papers, datos, código y el *Audio Atlas* de modelos generativos de audio.

</div>
