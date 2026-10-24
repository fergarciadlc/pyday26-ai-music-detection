"""A binary detector in PyTorch: real audio, or audio that went through EnCodec?

The synthetic-data trick: take real music, pass it through a neural codec
(encode -> decode) and train a CNN to tell the two versions apart. The music is
the same; the only difference is the decoder's artifacts.

Run with:
    uv run --group audio examples/03_detector_pytorch.py
"""

# %% Imports and settings
import json
import random
from pathlib import Path

import librosa
import musdb
import numpy as np
import torch
from torch import nn
from transformers import EncodecModel

SR = 24_000  # EnCodec works at 24 kHz
BANDWIDTH = 3.0  # kbps, the same bitrate as in the fakeprints section
WIN = int(2.5 * SR)  # 2.5 s windows...
HOP = WIN // 2  # ...with 50% overlap
N_FFT, STFT_HOP = 2048, 512  # the same parameters as the librosa snippet
EPOCHS, BATCH = 8, 16
OUT = Path("docs/assets/examples/03")

# Fixed seed so every run gives (almost) the same numbers.
random.seed(0)
np.random.seed(0)
torch.manual_seed(0)
device = "mps" if torch.backends.mps.is_available() else "cpu"  # Apple GPU if available
print("Device:", device)

# %% The codec: pass audio through EnCodec (encode -> decode)
# --8<-- [start:codec]
codec = EncodecModel.from_pretrained("facebook/encodec_24khz").eval()


def through_codec(y: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        enc = codec.encode(torch.from_numpy(y)[None, None], bandwidth=BANDWIDTH)
        y_hat = codec.decode(enc.audio_codes, enc.audio_scales)[0]
    return y_hat[0, 0].numpy()[: len(y)]


def to_24k_mono(y: np.ndarray, sr: int) -> np.ndarray:
    # Careful: resample the real audio to 24 kHz mono FIRST, and only then make the
    # codec version. Otherwise the model would learn "is there content above 12 kHz?"
    # instead of the decoder's artifacts.
    y = librosa.resample(librosa.to_mono(y), orig_sr=sr, target_sr=SR)
    return (0.9 * y / (np.abs(y).max() + 1e-9)).astype(np.float32)


# --8<-- [end:codec]


# %% Features: log-magnitude spectrogram per window
# --8<-- [start:features]
def windows(y: np.ndarray) -> np.ndarray:
    """Cut the audio into windows and compute log|STFT| of each one."""
    starts = range(0, len(y) - WIN + 1, HOP)
    specs = [np.abs(librosa.stft(y[s : s + WIN], n_fft=N_FFT, hop_length=STFT_HOP)) for s in starts]
    return np.log(np.stack(specs) + 1e-5).astype(np.float32)  # (windows, freqs, time)


# --8<-- [end:features]


# %% Data: MUSDB18 (free 7 s preview of each song), mixtures only
# The train/test split is BY SONG: no window of a test song is ever seen in
# training (otherwise the model could simply "remember" the song).
# --8<-- [start:data]
def build_split(subset: str):
    X, y, track_ids = [], [], []
    for i, track in enumerate(musdb.DB(download=True, subsets=subset)):
        real = to_24k_mono(track.audio.T, track.rate)  # .audio is the mixture
        for label, audio in [(0, real), (1, through_codec(real))]:  # 0 = real, 1 = codec
            w = windows(audio)
            X.append(w)
            y += [label] * len(w)
            track_ids += [i] * len(w)
    X = torch.from_numpy(np.concatenate(X))[:, None]
    return X, torch.tensor(y, dtype=torch.float32), np.array(track_ids)


X_train, y_train, train_tracks = build_split("train")
X_test, y_test, test_tracks = build_split("test")
print(f"Windows: train {len(X_train)}, test {len(X_test)}; shape {tuple(X_train.shape[1:])}")
# --8<-- [end:data]


# %% The model: conv blocks -> global pooling -> dense layer -> 1 logit
# --8<-- [start:model]
def conv_block(c_in: int, c_out: int) -> nn.Sequential:
    # conv finds local patterns, batch norm keeps values stable, ReLU adds
    # non-linearity, max-pool halves the size.
    return nn.Sequential(
        nn.Conv2d(c_in, c_out, 3, padding=1), nn.BatchNorm2d(c_out), nn.ReLU(), nn.MaxPool2d(2)
    )


# fmt: off
model = nn.Sequential(
    nn.BatchNorm2d(1),  # normalise the scale of the input spectrogram
    conv_block(1, 16), conv_block(16, 32), conv_block(32, 64),
    conv_block(64, 128), conv_block(128, 256), conv_block(256, 512),
    nn.AdaptiveAvgPool2d(1), nn.Flatten(),  # global average pooling: one number per channel
    nn.Linear(512, 128), nn.ReLU(),  # dense layer, 128 units
    nn.Linear(128, 1),  # 1 logit: > 0 means "codec"
).to(device)
# fmt: on
loss_fn = nn.BCEWithLogitsLoss()  # sigmoid + binary cross-entropy in one step
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
# --8<-- [end:model]


# %% Training
# --8<-- [start:training]
@torch.no_grad()
def predict(X: torch.Tensor) -> np.ndarray:
    """Probability of 'codec' for each window."""
    model.eval()
    logits = torch.cat([model(X[i : i + 64].to(device)).cpu() for i in range(0, len(X), 64)])
    return torch.sigmoid(logits).squeeze(1).numpy()


history = []
for epoch in range(1, EPOCHS + 1):
    model.train()
    perm = torch.randperm(len(X_train))  # shuffle the examples every epoch
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
    history.append(
        {
            "epoch": epoch,
            "train_loss": round(total_loss / len(X_train), 4),
            "train_acc": round(correct / len(X_train), 4),
            "test_acc": round(test_acc, 4),
        }
    )
    print(history[-1])
# --8<-- [end:training]

# %% Evaluation: per window and per song
p_test = predict(X_test)
window_acc = float(((p_test > 0.5) == y_test.numpy()).mean())
# Per song: average the windows of each (song, version) and decide once.
labels = y_test.numpy()
groups = set(zip(test_tracks, labels, strict=True))
track_acc = float(
    np.mean(
        [(p_test[(test_tracks == t) & (labels == lab)].mean() > 0.5) == lab for t, lab in groups]
    )
)
print(f"Test accuracy: per window {window_acc:.3f}, per song {track_acc:.3f}")


# %% For fun (and honesty): audio the model has never seen
# --8<-- [start:unseen]
def score_file(path: str, codec_version: bool = False) -> float:
    y, sr = librosa.load(path, sr=None, mono=False)
    y = to_24k_mono(y, sr)
    if codec_version:
        y = through_codec(y)
    return round(float(predict(torch.from_numpy(windows(y))[:, None]).mean()), 4)


files = {
    "guitar.mp3 (real)": score_file("audio/guitar.mp3"),
    "guitar.mp3 + EnCodec": score_file("audio/guitar.mp3", codec_version=True),
    "clip-3.mp3 (AI, Suno)": score_file("docs/assets/quiz/clip-3.mp3"),
    "clip-4.mp3 (hybrid: human guitar + Suno)": score_file("docs/assets/quiz/clip-4.mp3"),
    "clip-5.mp3 (AI, Suno)": score_file("docs/assets/quiz/clip-5.mp3"),
}
for name, p in files.items():
    print(f"P(codec) = {p:.3f}  {name}")
# The model has only seen EnCodec: if it fails on Suno, that is exactly the
# generalisation problem. A detector learns the fingerprint of the decoders it knows.
# --8<-- [end:unseen]

# %% Save the results
OUT.mkdir(parents=True, exist_ok=True)
results = {
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
}
(OUT / "results.json").write_text(json.dumps(results, indent=1))
