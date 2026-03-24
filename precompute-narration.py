#!/usr/bin/env python3
"""Pre-compute narration payloads (base64 WAV + volumes) for each slide."""
import base64
import json
import os
from pydub import AudioSegment
from pydub.utils import make_chunks

NARRATION_DIR = "assets/narration"
CHUNK_MS = 20

for fname in sorted(os.listdir(NARRATION_DIR)):
    if not fname.endswith(".mp3"):
        continue
    slide = fname.replace(".mp3", "")  # e.g. "slide-0"
    path = os.path.join(NARRATION_DIR, fname)
    out_path = os.path.join(NARRATION_DIR, f"{slide}.json")

    audio = AudioSegment.from_file(path)
    wav_bytes = audio.export(format="wav").read()
    audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")

    chunks = make_chunks(audio, CHUNK_MS)
    volumes = [chunk.rms for chunk in chunks]
    max_vol = max(volumes) if volumes else 1
    volumes = [round(v / max_vol, 4) for v in volumes]

    payload = {
        "type": "audio",
        "audio": audio_b64,
        "volumes": volumes,
        "slice_length": CHUNK_MS,
        "display_text": None,
        "actions": None,
        "forwarded": False,
    }

    with open(out_path, "w") as f:
        json.dump(payload, f)

    print(f"{slide}: {len(volumes)} samples, {os.path.getsize(out_path) // 1024}KB")

# Clean up old combined file
combined = os.path.join(NARRATION_DIR, "payloads.json")
if os.path.exists(combined):
    os.remove(combined)
    print(f"Removed {combined}")

print("Done.")
