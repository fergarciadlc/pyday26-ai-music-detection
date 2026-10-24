"""Precompute the data behind the website's fakeprints panel.

Takes one real recording, passes it through EnCodec (encode -> decode) at
several bitrates and writes, for each version:

- the audio (mp3, for listening in the browser),
- the audio of the difference reconstructed - original,
- a spectrogram image,
- the high-resolution mean spectrum and its residual above the spectral
  envelope, where the decoder's fakeprint shows up as peaks every 600 Hz.

Usage:
    uv run --group audio scripts/build_fakeprints.py audio/guitar.mp3
"""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import librosa
import matplotlib
import numpy as np
import soundfile as sf
import torch
from matplotlib.colors import LinearSegmentedColormap
from scipy.ndimage import minimum_filter1d, uniform_filter1d, zoom
from transformers import EncodecModel

matplotlib.use("Agg")
import matplotlib.pyplot as plt

SR = 24_000  # EnCodec 24 kHz
BANDWIDTHS = [1.5, 3.0, 6.0, 12.0, 24.0]  # kbps
# The decoder upsamples by 2, 4, 5, 8 (in that order from the output); the
# period of the fakeprint comb is SR / (2 * 4 * 5) = 600 Hz.
COMB_HZ = 600
BAND = (2_000, 11_500)  # Hz range used to measure and fold the comb

CMAP = LinearSegmentedColormap.from_list(
    "pyday", ["#070a1f", "#1d2a7a", "#7a1fa2", "#e0267d", "#ff8a3d", "#ffe27a"]
)


def reconstruct(model: EncodecModel, y: np.ndarray, bandwidth: float) -> np.ndarray:
    with torch.no_grad():
        x = torch.from_numpy(y)[None, None]
        enc = model.encode(x, bandwidth=bandwidth)
        y_hat = model.decode(enc.audio_codes, enc.audio_scales)[0]
    return y_hat[0, 0].numpy()[: len(y)]


def residual_spectrum(y: np.ndarray) -> np.ndarray:
    """Mean spectrum in dB at 1 Hz resolution, minus its lower envelope.

    What remains are narrow peaks: the music's partials and, in decoded audio,
    the fixed-frequency peaks left by the upsampling layers.
    """
    S = np.abs(librosa.stft(y, n_fft=SR, hop_length=SR // 4))
    m = 20 * np.log10(S.mean(axis=1) + 1e-10)
    envelope = uniform_filter1d(minimum_filter1d(m, 201), 201)
    return np.clip(m - envelope, 0, None)


def comb_contrast(res: np.ndarray, period: int = COMB_HZ, tol: int = 2) -> float:
    """dB on the comb (multiples of `period`) minus dB off the comb, in BAND."""
    f = np.arange(len(res))
    band = (f >= BAND[0]) & (f <= BAND[1])
    dist = np.abs(((f + period / 2) % period) - period / 2)
    on = band & (dist <= tol)
    return float(res[on].mean() - res[band & ~on].mean())


def fold(res: np.ndarray, period: int = COMB_HZ) -> np.ndarray:
    """Average the residual over all periods in BAND: offset -period/2..period/2-1."""
    f = np.arange(len(res))
    band = (f >= BAND[0]) & (f <= BAND[1])
    offset = ((f + period // 2) % period)[band]
    return np.bincount(offset, res[band], period) / np.bincount(offset, minlength=period)


def spectrogram_image(y: np.ndarray, path: Path, width: int = 1200, height: int = 400) -> None:
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=256))
    S_db = librosa.amplitude_to_db(S, ref=np.max(S))
    S_db = np.clip(S_db, -70, 0)[::-1]  # low frequencies at the bottom
    S_db = zoom(S_db, (height / S_db.shape[0], width / S_db.shape[1]), order=1)
    plt.imsave(path, S_db, cmap=CMAP, vmin=-70, vmax=0, pil_kwargs={"quality": 85})


def write_mp3(y: np.ndarray, path: Path) -> None:
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        sf.write(tmp.name, y, SR)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name,
             "-codec:a", "libmp3lame", "-b:a", "128k", "-map_metadata", "-1", str(path)],
            check=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", type=Path, help="real recording (any format librosa reads)")
    parser.add_argument("--out", type=Path, default=Path("docs/assets/fakeprints"))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    y, _ = librosa.load(args.source, sr=SR, mono=True)
    y = 0.9 * y / np.max(np.abs(y))
    model = EncodecModel.from_pretrained("facebook/encodec_24khz").eval()

    versions = {"original": y}
    for bw in BANDWIDTHS:
        versions[f"{bw:g}"] = reconstruct(model, y, bw)

    data = {
        "sr": SR,
        "duration": len(y) / SR,
        "comb_hz": COMB_HZ,
        "band": BAND,
        "bandwidths": [f"{bw:g}" for bw in BANDWIDTHS],
        "versions": {},
    }
    for key, sig in versions.items():
        write_mp3(sig, args.out / f"{key}.mp3")
        spectrogram_image(sig, args.out / f"{key}.jpg")
        res = residual_spectrum(sig)
        entry = {
            "spectrum": np.round(res[: SR // 2].astype(float), 1).tolist(),
            "folded": np.round(fold(res).astype(float), 2).tolist(),
            "comb_db": round(comb_contrast(res), 2),
        }
        if key != "original":
            diff = sig - y
            entry["snr_db"] = round(float(10 * np.log10(np.sum(y**2) / np.sum(diff**2))), 1)
            # Normalised so the artifacts are audible; the real level is snr_db below the music.
            write_mp3(0.9 * diff / np.max(np.abs(diff)), args.out / f"diff_{key}.mp3")
            spectrogram_image(diff, args.out / f"diff_{key}.jpg")
        data["versions"][key] = entry
        print(f"{key:>8}: comb {entry['comb_db']:+.2f} dB" + (f", SNR {entry['snr_db']} dB" if "snr_db" in entry else ""))

    (args.out / "data.json").write_text(json.dumps(data, separators=(",", ":")))


if __name__ == "__main__":
    main()
