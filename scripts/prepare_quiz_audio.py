"""Copy the quiz clips into the site with neutral names and no metadata.

The original files carry ID3 tags such as "made with suno" that would give
the answer away, so every tag and embedded image is dropped (the audio
stream is copied as is, without re-encoding).

Usage:
    uv run scripts/prepare_quiz_audio.py
"""

import subprocess
from pathlib import Path

# Numbering follows the order of the clips in the slides (slide 4).
CLIPS = {
    "clip-3.mp3": "audio/jazz_dishes.mp3",
    "clip-4.mp3": "audio/lofi.mp3",
    "clip-5.mp3": "audio/rnb_dishes.mp3",
}
OUT = Path("docs/assets/quiz")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src in CLIPS.items():
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                src,
                "-map",
                "0:a",
                "-c:a",
                "copy",
                "-map_metadata",
                "-1",
                "-id3v2_version",
                "0",
                "-write_id3v1",
                "0",
                str(OUT / name),
            ],
            check=True,
        )
        print(f"{src} -> {OUT / name}")


if __name__ == "__main__":
    main()
