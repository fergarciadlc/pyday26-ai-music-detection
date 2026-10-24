# %% [markdown]
# # 02 · Un codec neuronal por dentro: encoder, latentes y decoder
#
# Corre este script con:
#     uv run --group audio examples/02_codec_latentes.py
#
# Guarda los audios e imágenes en docs/assets/examples/02/ (los que escuchas en la web).

# %%
# --8<-- [start:cargar]
import librosa
import numpy as np
import torch
from transformers import EncodecModel

# EnCodec es el codec neuronal de Meta que usan modelos como MusicGen.
model = EncodecModel.from_pretrained("facebook/encodec_24khz").eval()

y, sr = librosa.load("audio/guitar.mp3", sr=24_000)  # EnCodec trabaja a 24 kHz
x = torch.from_numpy(y)[None, None]  # forma (batch, canales, muestras)
print(x.shape)  # torch.Size([1, 1, 416689])
# --8<-- [end:cargar]

# %%
# --8<-- [start:encoder]
with torch.no_grad():
    latentes = model.encoder(x)

print(latentes.shape)  # torch.Size([1, 128, 1303])
# 128 números por cada "frame", y 75 frames por segundo de audio.
# --8<-- [end:encoder]

# %%
# --8<-- [start:codigos]
with torch.no_grad():
    # El cuantizador cambia cada vector de 128 números por el índice del vector
    # más parecido de un "diccionario" (codebook) de 1024 entradas.
    codigos = model.quantizer.encode(latentes, bandwidth=3.0)

print(codigos.shape)  # torch.Size([4, 1, 1303]): 4 codebooks x 1303 frames
print(codigos[:, 0, :8])  # números enteros entre 0 y 1023

bits_audio = len(y) * 16  # audio sin comprimir, 16 bits por muestra
bits_codigos = codigos.numel() * 10  # cada código cabe en 10 bits (2^10 = 1024)
print(f"{bits_audio / bits_codigos:.0f} veces más pequeño")  # 128 veces
# --8<-- [end:codigos]

# %%
# --8<-- [start:decoder]
def decodificar(latentes):
    """Pasa latentes por el decoder y regresa audio como array de NumPy."""
    with torch.no_grad():
        audio = model.decoder(latentes)
    return audio[0, 0, : len(y)].numpy()


with torch.no_grad():
    reconstruccion = decodificar(model.quantizer.decode(codigos))
# --8<-- [end:decoder]

# %%
# --8<-- [start:modificar]
torch.manual_seed(0)
escala = latentes.std()
n_frames = latentes.shape[-1]


def ruido(nivel):
    """Ruido aleatorio con la misma escala que los latentes."""
    return nivel * escala * torch.randn_like(latentes)


experimentos = {
    "reconstruccion": reconstruccion,
    # Un poco de ruido: el decoder lo aguanta bastante bien.
    "ruido_poco": decodificar(latentes + ruido(0.3)),
    # Mucho ruido: la guitarra se pierde.
    "ruido_mucho": decodificar(latentes + ruido(1.5)),
    # Los mismos latentes, al revés en el tiempo.
    "al_reves": decodificar(torch.flip(latentes, dims=[-1])),
    # Repetimos un solo frame (el del segundo 3) durante todo el audio.
    "congelado": decodificar(latentes[..., 225:226].repeat(1, 1, n_frames)),
}
# --8<-- [end:modificar]

# %%
# --8<-- [start:inventar]
experimentos |= {
    # Latentes inventados: números al azar con la misma escala que los reales.
    "aleatorios": decodificar(ruido(1.0) + latentes.mean()),
    # Códigos al azar: índices aleatorios del diccionario.
    "codigos_aleatorios": decodificar(model.quantizer.decode(torch.randint(0, 1024, codigos.shape))),
    # Nada: todos los latentes en cero.
    "ceros": decodificar(torch.zeros_like(latentes)),
}
# --8<-- [end:inventar]

# %%
# --8<-- [start:huella]
from scipy.ndimage import minimum_filter1d, uniform_filter1d


def huella_600hz(audio, sr=24_000):
    """Cuántos dB sobresalen los picos en múltiplos de 600 Hz (ver la página de fakeprints)."""
    S = np.abs(librosa.stft(audio, n_fft=sr, hop_length=sr // 4))  # resolución de 1 Hz
    espectro = 20 * np.log10(S.mean(axis=1) + 1e-10)
    picos = espectro - uniform_filter1d(minimum_filter1d(espectro, 201), 201)
    f = np.arange(len(picos))
    banda = (f >= 2_000) & (f <= 11_500)
    en_rejilla = banda & (np.abs((f + 300) % 600 - 300) <= 2)
    return picos[en_rejilla].mean() - picos[banda & ~en_rejilla].mean()


print(f"{'original':>20}: {huella_600hz(y):+5.1f} dB")
for nombre, audio in experimentos.items():
    print(f"{nombre:>20}: {huella_600hz(audio):+5.1f} dB")
# --8<-- [end:huella]

# %%
# Lo que sigue solo guarda los archivos para la web.
import json
from pathlib import Path

import matplotlib.pyplot as plt
import soundfile as sf

out = Path("docs/assets/examples/02")
out.mkdir(parents=True, exist_ok=True)


def guardar(nombre, audio, rms=0.08):
    """Todos al mismo volumen (RMS) para poder compararlos al oído."""
    audio = audio * rms / (np.sqrt(np.mean(audio**2)) + 1e-12)
    sf.write(out / f"{nombre}.mp3", np.clip(audio, -0.98, 0.98), sr, format="MP3")


guardar("original", y)
resultados = {"original": round(float(huella_600hz(y)), 1)}
for nombre, audio in experimentos.items():
    guardar(nombre, audio)
    resultados[nombre] = round(float(huella_600hz(audio)), 1)

info = {
    "muestras": len(y),
    "latentes": list(latentes.shape),
    "codigos": list(codigos.shape),
    "compresion": round(bits_audio / bits_codigos),
    "huella_db": resultados,
}
(out / "resultados.json").write_text(json.dumps(info, indent=2, ensure_ascii=False))

# Los latentes y los códigos de los primeros 4 segundos, dibujados como imágenes.
frames = 300
fig, axes = plt.subplots(2, 1, figsize=(10, 5.2), height_ratios=[3, 1])
axes[0].imshow(latentes[0, :, :frames].numpy(), aspect="auto", cmap="magma", interpolation="nearest")
axes[0].set(title="Latentes del encoder (128 números por frame)", ylabel="dimensión")
axes[1].imshow(codigos[:, 0, :frames].numpy(), aspect="auto", cmap="viridis", interpolation="nearest")
axes[1].set(title="Códigos (4 codebooks, enteros de 0 a 1023)", xlabel="frame (75 por segundo)", ylabel="codebook")
fig.tight_layout()
fig.savefig(out / "latentes.png", dpi=130)
print(json.dumps(info, indent=2, ensure_ascii=False))
