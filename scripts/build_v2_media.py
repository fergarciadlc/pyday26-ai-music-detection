"""Media for the v2 page: spectrograms of the codec examples and waveforms for the diagram.

Reads the audio written by examples/02_codec_latents.py and writes:
- web/static/spec/<name>.jpg: spectrograms on a shared dB scale, so they can be compared
  (the example saves every clip at the same loudness);
- web/static/media.json: durations and a coarse waveform envelope per clip.

Usage:
    uv run --group audio scripts/build_v2_media.py
"""

import json
from pathlib import Path

import librosa
import matplotlib
import numpy as np
from matplotlib.colors import LinearSegmentedColormap
from scipy.ndimage import zoom

matplotlib.use("Agg")
import matplotlib.pyplot as plt

SR = 24_000
SRC = Path("docs/assets/examples/02")
OUT = Path("web/static")
NAMES = ["original", "reconstruction", "random_latents", "zeros"]
CMAP = LinearSegmentedColormap.from_list(
    "pyday", ["#070a1f", "#1d2a7a", "#7a1fa2", "#e0267d", "#ff8a3d", "#ffe27a"]
)
WIDTH, HEIGHT, RANGE_DB = 900, 240, 72
# Rows are spaced as f = 12 kHz * t², so the bottom half of the image covers 0–3 kHz,
# where the guitar lives, and the top half still shows the decoder's high-frequency lines.
WARP = 12_000 * np.linspace(0, 1, HEIGHT) ** 2


def main() -> None:
    (OUT / "spec").mkdir(parents=True, exist_ok=True)
    audio = {n: librosa.load(SRC / f"{n}.mp3", sr=SR)[0] for n in NAMES}
    specs = {n: np.abs(librosa.stft(y, n_fft=1024, hop_length=256)) for n, y in audio.items()}
    ref = max(S.max() for S in specs.values())

    media = {}
    for name, S in specs.items():
        S_db = np.clip(librosa.amplitude_to_db(S, ref=ref), -RANGE_DB, 0)
        freqs = librosa.fft_frequencies(sr=SR, n_fft=1024)
        S_db = np.stack([np.interp(WARP, freqs, col) for col in S_db.T], axis=1)[::-1]
        S_db = zoom(S_db, (1, WIDTH / S_db.shape[1]), order=1)
        plt.imsave(
            OUT / "spec" / f"{name}.jpg",
            S_db,
            cmap=CMAP,
            vmin=-RANGE_DB,
            vmax=0,
            pil_kwargs={"quality": 86},
        )

        y = audio[name]
        bars = np.array_split(np.abs(y), 96)
        env = np.array([b.max() for b in bars])
        media[name] = {
            "duration": round(len(y) / SR, 3),
            "wave": np.round(env / env.max(), 3).tolist(),
        }
        print(f"{name:>15}: {len(y) / SR:.2f} s")

    (OUT / "media.json").write_text(json.dumps(media, separators=(",", ":")))


if __name__ == "__main__":
    main()
