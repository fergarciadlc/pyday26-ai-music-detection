# %% [markdown]
# # 02 · Inside a neural codec: encoder, latents and decoder
#
# Run with:
#     uv run --group audio examples/02_codec_latents.py
#
# Saves the audio and figures used on the site to docs/assets/examples/02/.

# %%
# --8<-- [start:load]
import librosa
import numpy as np
import torch
from transformers import EncodecModel

# EnCodec is Meta's neural audio codec, used by models such as MusicGen.
model = EncodecModel.from_pretrained("facebook/encodec_24khz").eval()

y, sr = librosa.load("audio/guitar.mp3", sr=24_000)  # EnCodec works at 24 kHz
x = torch.from_numpy(y)[None, None]  # shape (batch, channels, samples)
print(x.shape)  # torch.Size([1, 1, 416689])
# --8<-- [end:load]

# %%
# --8<-- [start:encoder]
with torch.no_grad():
    latents = model.encoder(x)

print(latents.shape)  # torch.Size([1, 128, 1303])
# 128 numbers per frame, 75 frames per second of audio.
# --8<-- [end:encoder]

# %%
# --8<-- [start:codes]
with torch.no_grad():
    # The quantizer replaces each 128-number vector with the index of the closest
    # vector in a "dictionary" (codebook) of 1024 entries.
    codes = model.quantizer.encode(latents, bandwidth=3.0)

print(codes.shape)  # torch.Size([4, 1, 1303]): 4 codebooks x 1303 frames
print(codes[:, 0, :8])  # integers between 0 and 1023

audio_bits = len(y) * 16  # uncompressed audio, 16 bits per sample
code_bits = codes.numel() * 10  # each code fits in 10 bits (2^10 = 1024)
print(f"{audio_bits / code_bits:.0f}x smaller")  # 128x
# --8<-- [end:codes]


# %%
# --8<-- [start:decoder]
def decode(latents):
    """Run latents through the decoder and return the audio as a NumPy array."""
    with torch.no_grad():
        audio = model.decoder(latents)
    return audio[0, 0, : len(y)].numpy()


with torch.no_grad():
    reconstruction = decode(model.quantizer.decode(codes))
# --8<-- [end:decoder]

# %%
# --8<-- [start:modify]
torch.manual_seed(0)
scale = latents.std()
n_frames = latents.shape[-1]


def noise(level):
    """Random noise at the same scale as the latents."""
    return level * scale * torch.randn_like(latents)


experiments = {
    "reconstruction": reconstruction,
    # A little noise: the decoder copes quite well.
    "noise_small": decode(latents + noise(0.3)),
    # A lot of noise: the guitar is lost.
    "noise_large": decode(latents + noise(1.5)),
    # The same latents, reversed in time.
    "reversed": decode(torch.flip(latents, dims=[-1])),
    # Repeat a single frame (the one at 3 s) for the whole clip.
    "frozen": decode(latents[..., 225:226].repeat(1, 1, n_frames)),
}
# --8<-- [end:modify]

# %%
# --8<-- [start:invent]
experiments |= {
    # Invented latents: random numbers at the same scale as the real ones.
    "random_latents": decode(noise(1.0) + latents.mean()),
    # Random codes: random indices into the codebooks.
    "random_codes": decode(model.quantizer.decode(torch.randint(0, 1024, codes.shape))),
    # Nothing at all: every latent set to zero.
    "zeros": decode(torch.zeros_like(latents)),
}
# --8<-- [end:invent]

# %%
# --8<-- [start:fingerprint]
from scipy.ndimage import minimum_filter1d, uniform_filter1d


def fingerprint_600hz(audio, sr=24_000):
    """How many dB the peaks at multiples of 600 Hz stand out (see the fakeprints section)."""
    S = np.abs(librosa.stft(audio, n_fft=sr, hop_length=sr // 4))  # 1 Hz resolution
    spectrum = 20 * np.log10(S.mean(axis=1) + 1e-10)
    peaks = spectrum - uniform_filter1d(minimum_filter1d(spectrum, 201), 201)
    f = np.arange(len(peaks))
    band = (f >= 2_000) & (f <= 11_500)
    on_grid = band & (np.abs((f + 300) % 600 - 300) <= 2)
    return peaks[on_grid].mean() - peaks[band & ~on_grid].mean()


print(f"{'original':>16}: {fingerprint_600hz(y):+5.1f} dB")
for name, audio in experiments.items():
    print(f"{name:>16}: {fingerprint_600hz(audio):+5.1f} dB")
# --8<-- [end:fingerprint]

# %%
# Everything below only saves files for the site.
import json
from pathlib import Path

import matplotlib.pyplot as plt
import pyloudnorm as pyln
import soundfile as sf

out = Path("docs/assets/examples/02")
out.mkdir(parents=True, exist_ok=True)
meter = pyln.Meter(sr)  # perceived loudness (LUFS, ITU-R BS.1770)
INVENTED = {"random_latents", "random_codes", "zeros"}


def save(name, audio, lufs=-23.0):
    """Save every clip at the same loudness so they can be compared by ear.

    Steady noise and tones feel louder than a guitar at the same measured loudness,
    so the invented-latent clips are saved 6 dB lower.
    """
    target = lufs - (6.0 if name in INVENTED else 0.0)
    audio = pyln.normalize.loudness(audio, meter.integrated_loudness(audio), target)
    sf.write(out / f"{name}.mp3", np.clip(audio, -0.98, 0.98), sr, format="MP3")


save("original", y)
fingerprints = {"original": round(float(fingerprint_600hz(y)), 1)}
for name, audio in experiments.items():
    save(name, audio)
    fingerprints[name] = round(float(fingerprint_600hz(audio)), 1)

info = {
    "samples": len(y),
    "latents": list(latents.shape),
    "codes": list(codes.shape),
    "compression": round(audio_bits / code_bits),
    "fingerprint_db": fingerprints,
}
(out / "results.json").write_text(json.dumps(info, indent=2))

# The latents and codes of the first 4 seconds, drawn as images.
frames = 300
fig, axes = plt.subplots(2, 1, figsize=(10, 5.2), height_ratios=[3, 1])
axes[0].imshow(latents[0, :, :frames].numpy(), aspect="auto", cmap="magma", interpolation="nearest")
axes[0].set(title="Encoder latents (128 numbers per frame)", ylabel="dimension")
axes[1].imshow(codes[:, 0, :frames].numpy(), aspect="auto", cmap="viridis", interpolation="nearest")
axes[1].set(
    title="Codes (4 codebooks, integers from 0 to 1023)",
    xlabel="frame (75 per second)",
    ylabel="codebook",
)
fig.tight_layout()
fig.savefig(out / "latents.png", dpi=130)
print(json.dumps(info, indent=2))
