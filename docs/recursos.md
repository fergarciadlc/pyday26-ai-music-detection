---
title: Recursos
---

# Recursos

Todo lo que se menciona en la charla, por sección.

## Material de la charla

- [Slides en PDF](assets/slides/pyday26mx-ai-music-detection.pdf)
- [Código de esta web](https://github.com/fergarciadlc/pyday26-ai-music-detection): los ejemplos de [espectrogramas](detecta/espectrogramas.md), del [codec y sus latentes](genera.md) y del [detector en PyTorch](detecta/detector.md), y los scripts que generan los audios de [fakeprints](detecta/fakeprints.md)
- [**Audio Atlas**](atlas.html){ target="_blank" }: un mapa interactivo de los modelos generativos de audio (voz, música, efectos, codecs) y su linaje (en inglés)

## 01 · Contexto actual

**Deezer** publica cada pocos meses cuánta música generada por IA recibe:

| Fecha | Dato | Fuente |
|---|---|---|
| Enero 2025 | ~10,000 canciones IA al día, 10% de las subidas | [Deezer Newsroom](https://newsroom-deezer.com/2025/01/deezer-deploys-cutting-edge-ai-detection-tool-for-music-streaming/) |
| Abril 2025 | 18% de las subidas | [Deezer Newsroom](https://newsroom-deezer.com/2025/04/deezer-reveals-18-of-all-new-music-uploaded-to-streaming-is-fully-ai-generated/) |
| Septiembre 2025 | 28% de las subidas | [Deezer Newsroom](https://newsroom-deezer.com/2025/09/28-fully-ai-generated-music/) |
| Noviembre 2025 | Encuesta con Ipsos: 97% no distingue música IA, 80% quiere etiquetas | [Deezer Newsroom](https://newsroom-deezer.com/2025/11/deezer-ipsos-survey-ai-music/) |
| Abril 2026 | 44% de las subidas | [Deezer Newsroom](https://newsroom-deezer.com/2026/04/ai-generated-tracks-represent-44-of-new-uploaded-music/) |
| Julio 2026 | Más del 50% en días pico (~90,000 al día), 1–3% de las reproducciones | [Deezer Newsroom](https://newsroom-deezer.com/2026/07/ai-music-exceeds-50-percent-daily-uploads-deezer/) |

**La cita del CEO de Suno**

- Mikey Shulman en el podcast 20VC (enero 2025): [404 Media](https://www.404media.co/ceo-of-ai-music-company-says-people-dont-like-making-music/)
- Su rectificación, "I really wish I had chosen different words…" (marzo 2026): [Digital Music News](https://www.digitalmusicnews.com/2026/03/13/suno-ceo-backtracks-making-music-remarks/)

**Demandas y acuerdos**

- 2024: UMG, Sony y Warner demandan a Suno y Udio. [MusicTech](https://musictech.com/news/industry/record-labels-sue-ai-suno-copyright-infringement-sony-warner-umg)
- 2025: acuerdos de UMG con Udio ([MBW](https://www.musicbusinessworldwide.com/universal-music-settles-udio-lawsuit-strikes-deal-for-licensed-ai-music-platform)), de Warner con Udio ([MBW](https://www.musicbusinessworldwide.com/warner-music-settles-udio-lawsuit-strikes-licensing-deal-with-ai-platform)) y de Warner con Suno ([MBW](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno/)).
- 2026: el Landgericht München I falla a favor de GEMA contra Suno (sentencia aún no firme). [Comunicado del tribunal](https://www.justiz.bayern.de/gerichte-und-behoerden/landgericht/muenchen-1/presse/2026/16.php)

**Regulación y fraude**

- AI Act de la UE, artículo 50: el audio generado por IA debe marcarse de forma legible por máquinas. [AI Act Explorer](https://artificialintelligenceact.eu/article/50/)
- Fraude en regalías con canciones IA y bots en Estados Unidos: condena de 18 meses de prisión (octubre 2026). [MBW](https://www.musicbusinessworldwide.com/man-behind-8m-ai-song-and-bot-streaming-fraud-is-sentenced-to-18-months-in-prison/)

## 02 · Cómo se genera música con IA

- Défossez et al., [*High Fidelity Neural Audio Compression*](https://arxiv.org/abs/2210.13438) (EnCodec), 2022 · [modelo en Hugging Face](https://huggingface.co/facebook/encodec_24khz)
- Odena, Dumoulin y Olah, [*Deconvolution and Checkerboard Artifacts*](https://distill.pub/2016/deconv-checkerboard/), Distill 2016: el origen del patrón de tablero en imágenes

## 03 · Cómo se detecta

- Afchar, Meseguer-Brocal y Hennequin, [*AI-Generated Music Detection and its Challenges*](https://arxiv.org/abs/2501.10111), ICASSP 2025. La versión extendida es [*Detecting music deepfakes is easy but actually hard*](https://arxiv.org/abs/2405.04181).
- Afchar et al., [*A Fourier Explanation of AI-music Artifacts*](https://arxiv.org/abs/2506.19108), ISMIR 2025: por qué el decoder deja picos en frecuencias fijas
- Cros Vila, Sturm, Casini y Dalmazzo, [*The AI Music Arms Race: On the Detection of AI-Generated Music*](https://transactions.ismir.net/articles/10.5334/tismir.254), TISMIR 2025
- López-Ayala et al., [*AI-Generated Music Detection in Broadcast Monitoring*](https://arxiv.org/abs/2602.06823), ICASSP 2026
- Código del detector de Deezer (investigación): [github.com/deezer/deepfake-detector](https://github.com/deezer/deepfake-detector)

## 04 · Contenido híbrido

- Garcia de la Cruz, López-Ayala, Zinemanas, Molina y Rocamora,
  [*How Much AI Is in This Track? Quantifying the Proportion of AI-Generated Stems in Hybrid Music Mixtures*](https://arxiv.org/abs/2608.07285), ISMIR 2026
- Metodología ARIA: [github.com/fergarciadlc/aria](https://github.com/fergarciadlc/aria)
- Código de entrenamiento: [github.com/fergarciadlc/detector-models](https://github.com/fergarciadlc/detector-models)
- Pereira et al., [*MoisesDB: A dataset for source separation beyond 4-stems*](https://arxiv.org/abs/2307.15913), ISMIR 2023 · [repositorio](https://github.com/moises-ai/moises-db)
