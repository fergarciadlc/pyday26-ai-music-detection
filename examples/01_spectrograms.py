# %% [markdown]
# # 01 · Spectrograms: audio as an image
#
# Run with:
#     uv run --group audio examples/01_spectrograms.py
#
# Saves the figures shown on the site to docs/assets/examples/01/.

# %%
# --8<-- [start:load]
import librosa
import numpy as np

# Audio is just a very long list of numbers: air pressure measured
# thousands of times per second (here, 24,000 times per second).
y, sr = librosa.load("audio/guitar.mp3", sr=24_000)
print(f"{len(y):,} samples at {sr:,} Hz = {len(y) / sr:.1f} seconds")
print(y[:5])
# --8<-- [end:load]

# %%
# --8<-- [start:stft]
# The STFT cuts the audio into short windows and measures which frequencies sound in each.
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))

# We hear loudness on a logarithmic scale, so we convert to decibels.
S_db = librosa.amplitude_to_db(S, ref=np.max)

print(S_db.shape)  # (1025 frequencies, n time frames): an image!
# --8<-- [end:stft]

# %%
# --8<-- [start:plot]
import librosa.display
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(10, 4))
img = librosa.display.specshow(
    S_db, sr=sr, hop_length=512, x_axis="time", y_axis="hz", ax=ax, cmap="magma"
)
fig.colorbar(img, ax=ax, format="%+2.0f dB")
ax.set(title="Guitar spectrogram", xlabel="Time (s)", ylabel="Frequency (Hz)")
fig.savefig("docs/assets/examples/01/spectrogram.png", dpi=150, bbox_inches="tight")
# --8<-- [end:plot]

# %%
# --8<-- [start:mel]
# A popular variant: the mel scale groups frequencies the way the ear hears them
# (lots of detail in the lows, less in the highs). Many audio models use it.
M = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=2048, hop_length=512, n_mels=128)
M_db = librosa.power_to_db(M, ref=np.max)
print(M_db.shape)  # (128 mel bands, n time frames)

fig, ax = plt.subplots(figsize=(10, 4))
img = librosa.display.specshow(
    M_db, sr=sr, hop_length=512, x_axis="time", y_axis="mel", ax=ax, cmap="magma"
)
fig.colorbar(img, ax=ax, format="%+2.0f dB")
ax.set(title="Mel spectrogram", xlabel="Time (s)", ylabel="Frequency (Hz, mel scale)")
fig.savefig("docs/assets/examples/01/mel_spectrogram.png", dpi=150, bbox_inches="tight")
# --8<-- [end:mel]
