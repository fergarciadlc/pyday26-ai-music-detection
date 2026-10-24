# %% [markdown]
# # 01 · Espectrogramas: el audio como imagen
#
# Corre este script con:
#     uv run --group audio examples/01_espectrogramas.py
#
# Guarda las imágenes en docs/assets/examples/01/ (las que ves en la web).

# %%
# --8<-- [start:cargar]
import librosa
import numpy as np

# Un audio es solo una lista larguísima de números: la presión del aire medida
# miles de veces por segundo (aquí 24,000 veces por segundo).
y, sr = librosa.load("audio/guitar.mp3", sr=24_000)
print(f"{len(y):,} muestras a {sr:,} Hz = {len(y) / sr:.1f} segundos")
print(y[:5])
# --8<-- [end:cargar]

# %%
# --8<-- [start:stft]
# La STFT corta el audio en ventanitas y calcula qué frecuencias suenan en cada una.
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))

# El oído percibe el volumen en escala logarítmica, así que pasamos a decibeles.
S_db = librosa.amplitude_to_db(S, ref=np.max)

print(S_db.shape)  # (1025 frecuencias, n ventanas de tiempo): ¡una imagen!
# --8<-- [end:stft]

# %%
# --8<-- [start:dibujar]
import librosa.display
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(10, 4))
img = librosa.display.specshow(S_db, sr=sr, hop_length=512, x_axis="time", y_axis="hz", ax=ax, cmap="magma")
fig.colorbar(img, ax=ax, format="%+2.0f dB")
ax.set(title="Espectrograma de una guitarra", xlabel="Tiempo (s)", ylabel="Frecuencia (Hz)")
fig.savefig("docs/assets/examples/01/espectrograma.png", dpi=150, bbox_inches="tight")
# --8<-- [end:dibujar]

# %%
# --8<-- [start:mel]
# Variante muy usada: la escala mel agrupa las frecuencias como las escucha el oído
# (mucho detalle en graves, menos en agudos). Muchos modelos de audio usan esta versión.
M = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=2048, hop_length=512, n_mels=128)
M_db = librosa.power_to_db(M, ref=np.max)
print(M_db.shape)  # (128 bandas mel, n ventanas)

fig, ax = plt.subplots(figsize=(10, 4))
img = librosa.display.specshow(M_db, sr=sr, hop_length=512, x_axis="time", y_axis="mel", ax=ax, cmap="magma")
fig.colorbar(img, ax=ax, format="%+2.0f dB")
ax.set(title="Espectrograma mel", xlabel="Tiempo (s)", ylabel="Frecuencia (Hz, escala mel)")
fig.savefig("docs/assets/examples/01/espectrograma_mel.png", dpi=150, bbox_inches="tight")
# --8<-- [end:mel]
