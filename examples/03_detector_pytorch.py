"""Un detector binario en PyTorch: ¿audio real o audio que pasó por EnCodec?

El truco de los datos sintéticos: tomamos música real, la pasamos por un codec
neuronal (encode -> decode) y entrenamos una CNN para distinguir las dos
versiones. La música es la misma; lo único que cambia son los artefactos del
decoder.

Uso:
    uv run --python 3.12 --group audio examples/03_detector_pytorch.py
"""

# %% Imports y configuración
import json
import random
from pathlib import Path

import librosa
import musdb
import numpy as np
import torch
from torch import nn
from transformers import EncodecModel

SR = 24_000  # EnCodec trabaja a 24 kHz
BANDWIDTH = 3.0  # kbps, el mismo bitrate que en la página de fakeprints
WIN = int(2.5 * SR)  # ventanas de 2.5 s ...
HOP = WIN // 2  # ... que se traslapan a la mitad
N_FFT, STFT_HOP = 2048, 512  # los mismos parámetros que el snippet de librosa
EPOCHS, BATCH = 8, 16
OUT = Path("docs/assets/examples/03")

# Semilla fija: así cada corrida da (casi) los mismos números.
random.seed(0)
np.random.seed(0)
torch.manual_seed(0)
device = "mps" if torch.backends.mps.is_available() else "cpu"  # GPU de Mac si hay
print("Dispositivo:", device)

# %% El codec: pasar audio por EnCodec (encode -> decode)
# --8<-- [start:codec]
codec = EncodecModel.from_pretrained("facebook/encodec_24khz").eval()


def through_codec(y: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        enc = codec.encode(torch.from_numpy(y)[None, None], bandwidth=BANDWIDTH)
        y_hat = codec.decode(enc.audio_codes, enc.audio_scales)[0]
    return y_hat[0, 0].numpy()[: len(y)]


def to_24k_mono(y: np.ndarray, sr: int) -> np.ndarray:
    # ¡Ojo! Primero bajamos el audio real a 24 kHz mono y DESPUÉS hacemos la
    # versión codec. Si no, el modelo aprendería "¿hay agudos arriba de 12 kHz?"
    # en lugar de los artefactos del decoder.
    y = librosa.resample(librosa.to_mono(y), orig_sr=sr, target_sr=SR)
    return (0.9 * y / (np.abs(y).max() + 1e-9)).astype(np.float32)
# --8<-- [end:codec]


# %% Features: espectrograma log-magnitud por ventana
# --8<-- [start:features]
def windows(y: np.ndarray) -> np.ndarray:
    """Corta el audio en ventanas y calcula log|STFT| de cada una."""
    starts = range(0, len(y) - WIN + 1, HOP)
    specs = [np.abs(librosa.stft(y[s : s + WIN], n_fft=N_FFT, hop_length=STFT_HOP)) for s in starts]
    return np.log(np.stack(specs) + 1e-5).astype(np.float32)  # (ventanas, frecuencias, tiempo)
# --8<-- [end:features]


# %% Datos: MUSDB18 (versión gratuita de 7 s por canción), solo las mezclas
# La partición train/test es POR CANCIÓN: ninguna ventana de una canción de
# test aparece en train (si no, el modelo podría "recordar" la canción).
# --8<-- [start:datos]
def build_split(subset: str):
    X, y, track_ids = [], [], []
    for i, track in enumerate(musdb.DB(download=True, subsets=subset)):
        real = to_24k_mono(track.audio.T, track.rate)  # .audio es la mezcla
        for label, audio in [(0, real), (1, through_codec(real))]:  # 0 = real, 1 = codec
            w = windows(audio)
            X.append(w)
            y += [label] * len(w)
            track_ids += [i] * len(w)
    return torch.from_numpy(np.concatenate(X))[:, None], torch.tensor(y, dtype=torch.float32), np.array(track_ids)


X_train, y_train, train_tracks = build_split("train")
X_test, y_test, test_tracks = build_split("test")
print(f"Ventanas: train {len(X_train)}, test {len(X_test)}; forma {tuple(X_train.shape[1:])}")
# --8<-- [end:datos]


# %% El modelo: bloques conv -> pooling global -> capa densa -> 1 logit
# --8<-- [start:modelo]
def conv_block(c_in: int, c_out: int) -> nn.Sequential:
    # conv busca patrones locales, batchnorm estabiliza, ReLU agrega no-linealidad,
    # maxpool reduce el tamaño a la mitad.
    return nn.Sequential(
        nn.Conv2d(c_in, c_out, 3, padding=1), nn.BatchNorm2d(c_out), nn.ReLU(), nn.MaxPool2d(2)
    )


model = nn.Sequential(
    nn.BatchNorm2d(1),  # normaliza la escala del espectrograma de entrada
    conv_block(1, 16), conv_block(16, 32), conv_block(32, 64),
    conv_block(64, 128), conv_block(128, 256), conv_block(256, 512),
    nn.AdaptiveAvgPool2d(1), nn.Flatten(),  # promedio global: un número por canal
    nn.Linear(512, 128), nn.ReLU(),  # capa densa de 128 unidades
    nn.Linear(128, 1),  # 1 logit: > 0 significa "codec"
).to(device)
loss_fn = nn.BCEWithLogitsLoss()  # sigmoide + entropía cruzada binaria en un solo paso
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
# --8<-- [end:modelo]


# %% Entrenamiento
# --8<-- [start:entrenamiento]
@torch.no_grad()
def predict(X: torch.Tensor) -> np.ndarray:
    """Probabilidad de 'codec' para cada ventana."""
    model.eval()
    logits = torch.cat([model(X[i : i + 64].to(device)).cpu() for i in range(0, len(X), 64)])
    return torch.sigmoid(logits).squeeze(1).numpy()


history = []
for epoch in range(1, EPOCHS + 1):
    model.train()
    perm = torch.randperm(len(X_train))  # revolvemos los ejemplos en cada época
    total_loss, correct = 0.0, 0
    for i in range(0, len(perm), BATCH):
        idx = perm[i : i + BATCH]
        xb, yb = X_train[idx].to(device), y_train[idx].to(device)
        logits = model(xb).squeeze(1)
        loss = loss_fn(logits, yb)
        opt.zero_grad()
        loss.backward()
        opt.step()
        total_loss += loss.item() * len(idx)
        correct += ((logits > 0) == yb.bool()).sum().item()
    test_acc = float(((predict(X_test) > 0.5) == y_test.numpy()).mean())
    history.append({
        "epoch": epoch,
        "train_loss": round(total_loss / len(X_train), 4),
        "train_acc": round(correct / len(X_train), 4),
        "test_acc": round(test_acc, 4),
    })
    print(history[-1])
# --8<-- [end:entrenamiento]

# %% Evaluación: por ventana y por canción
p_test = predict(X_test)
window_acc = float(((p_test > 0.5) == y_test.numpy()).mean())
# Por canción: promediamos las ventanas de cada (canción, versión) y decidimos una vez.
labels = y_test.numpy()
groups = {(t, l) for t, l in zip(test_tracks, labels)}
track_acc = float(np.mean([
    (p_test[(test_tracks == t) & (labels == l)].mean() > 0.5) == l for t, l in groups
]))
print(f"Exactitud en test: por ventana {window_acc:.3f}, por canción {track_acc:.3f}")


# %% Por diversión (y honestidad): audio que el modelo nunca vio
# --8<-- [start:nuevos]
def score_file(path: str, codec_version: bool = False) -> float:
    y, sr = librosa.load(path, sr=None, mono=False)
    y = to_24k_mono(y, sr)
    if codec_version:
        y = through_codec(y)
    return round(float(predict(torch.from_numpy(windows(y))[:, None]).mean()), 4)


files = {
    "guitar.mp3 (real)": score_file("audio/guitar.mp3"),
    "guitar.mp3 + EnCodec": score_file("audio/guitar.mp3", codec_version=True),
    "clip-3.mp3 (IA, Suno)": score_file("docs/assets/quiz/clip-3.mp3"),
    "clip-4.mp3 (híbrido: guitarra humana + Suno)": score_file("docs/assets/quiz/clip-4.mp3"),
    "clip-5.mp3 (IA, Suno)": score_file("docs/assets/quiz/clip-5.mp3"),
}
for name, p in files.items():
    print(f"P(codec) = {p:.3f}  {name}")
# El modelo solo vio EnCodec: si falla con Suno, eso es justo el problema de la
# generalización. Un detector aprende la huella de los decoders que conoce.
# --8<-- [end:nuevos]

# %% Guardar resultados
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.json").write_text(json.dumps({
    "device": device,
    "dataset": {
        "train_tracks": len(np.unique(train_tracks)),
        "train_windows": len(X_train),
        "test_tracks": len(np.unique(test_tracks)),
        "test_windows": len(X_test),
    },
    "history": history,
    "test_window_acc": round(window_acc, 4),
    "test_track_acc": round(track_acc, 4),
    "p_codec": files,
}, ensure_ascii=False, indent=1))
