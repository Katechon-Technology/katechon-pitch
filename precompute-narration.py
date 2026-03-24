#!/usr/bin/env python3
"""Pre-compute narration payloads with AEIOU viseme data for Live2D lip sync.

Reads .tts.json files (ElevenLabs with-timestamps response) and produces
per-slide JSON payloads with base64 WAV audio + viseme arrays for the
Live2D mouth parameters: ParamA, ParamI, ParamU, ParamE, ParamO.

Falls back to RMS volume-only if .tts.json is missing but .mp3 exists.
"""
import base64
import io
import json
import os
from pydub import AudioSegment
from pydub.utils import make_chunks

NARRATION_DIR = "assets/narration"
CHUNK_MS = 20

# Character → AEIOU mouth shape weights.
# Based on approximate English pronunciation of each letter.
CHAR_VISEME = {
    # Vowels — dominant mouth shape
    'a': {'A': 1.0},
    'e': {'E': 0.7, 'I': 0.3},
    'i': {'I': 0.9, 'E': 0.1},
    'o': {'O': 1.0},
    'u': {'U': 1.0},
    # Lip consonants (lips press together)
    'b': {'A': 0.05},
    'p': {'A': 0.05},
    'm': {},
    # Labiodental (lower lip to upper teeth)
    'f': {'U': 0.3},
    'v': {'U': 0.3},
    # Rounded
    'w': {'U': 0.5, 'O': 0.3},
    'q': {'U': 0.4},
    # Dental / alveolar (tongue tip)
    't': {'I': 0.1},
    'd': {'I': 0.15, 'E': 0.1},
    'n': {'I': 0.15},
    'l': {'I': 0.2, 'E': 0.2},
    's': {'I': 0.2},
    'z': {'I': 0.2},
    # Velar (back of mouth)
    'k': {'E': 0.2},
    'g': {'E': 0.2},
    # Glottal / open
    'h': {'A': 0.3},
    # Other
    'r': {'O': 0.3, 'E': 0.15},
    'y': {'I': 0.5},
    'j': {'I': 0.3, 'E': 0.2},
    'c': {'I': 0.2},
    'x': {'I': 0.2, 'E': 0.1},
    # Silence / punctuation
    ' ': {},
    '.': {},
    ',': {},
    '!': {},
    '?': {},
    ':': {},
    ';': {},
    '-': {},
    "'": {},
    '"': {},
}


def smooth(arr, window=3):
    """Simple moving-average smooth."""
    out = list(arr)
    hw = window // 2
    for i in range(len(out)):
        lo = max(0, i - hw)
        hi = min(len(out), i + hw + 1)
        out[i] = sum(arr[lo:hi]) / (hi - lo)
    return out


def process_with_alignment(tts_path, out_path):
    """Process a .tts.json file (ElevenLabs with-timestamps response)."""
    with open(tts_path) as f:
        raw = json.load(f)

    # Decode audio: base64 MP3 → WAV → base64
    mp3_bytes = base64.b64decode(raw["audio_base64"])
    audio = AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
    wav_bytes = audio.export(format="wav").read()
    audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")

    duration_ms = len(audio)
    n_slices = duration_ms // CHUNK_MS + 1

    # Initialize viseme arrays
    vis = {k: [0.0] * n_slices for k in "AIUEO"}

    # Process alignment data
    alignment = raw.get("alignment") or raw.get("normalized_alignment", {})
    chars = alignment.get("characters", [])
    starts = alignment.get("character_start_times_seconds", [])
    ends = alignment.get("character_end_times_seconds", [])

    for ch, start_s, end_s in zip(chars, starts, ends):
        weights = CHAR_VISEME.get(ch.lower(), {})
        start_idx = int(start_s * 1000 / CHUNK_MS)
        end_idx = int(end_s * 1000 / CHUNK_MS) + 1
        for idx in range(max(0, start_idx), min(n_slices, end_idx)):
            for param, val in weights.items():
                vis[param][idx] = max(vis[param][idx], val)

    # Smooth for natural transitions
    for param in vis:
        vis[param] = [round(v, 3) for v in smooth(vis[param], window=3)]

    # Also compute RMS volumes as fallback
    chunks = make_chunks(audio, CHUNK_MS)
    volumes = [chunk.rms for chunk in chunks]
    max_vol = max(volumes) if volumes else 1
    volumes = [round(v / max_vol, 4) for v in volumes]

    payload = {
        "type": "audio",
        "audio": audio_b64,
        "visemes": {
            "slice_length": CHUNK_MS,
            "A": vis["A"],
            "I": vis["I"],
            "U": vis["U"],
            "E": vis["E"],
            "O": vis["O"],
        },
        "volumes": volumes,
        "slice_length": CHUNK_MS,
    }

    with open(out_path, "w") as f:
        json.dump(payload, f)

    slide = os.path.basename(tts_path).replace(".tts.json", "")
    print(f"{slide}: {n_slices} viseme slices, {len(chars)} characters aligned, {os.path.getsize(out_path) // 1024}KB")


def process_mp3_only(mp3_path, out_path):
    """Fallback: process .mp3 with RMS volumes only (no viseme data)."""
    audio = AudioSegment.from_file(mp3_path)
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

    slide = os.path.basename(mp3_path).replace(".mp3", "")
    print(f"{slide}: {len(volumes)} volume samples (no visemes), {os.path.getsize(out_path) // 1024}KB")


# Process all slides
seen = set()
for fname in sorted(os.listdir(NARRATION_DIR)):
    if fname.endswith(".tts.json"):
        slide = fname.replace(".tts.json", "")
        if slide in seen:
            continue
        seen.add(slide)
        tts_path = os.path.join(NARRATION_DIR, fname)
        out_path = os.path.join(NARRATION_DIR, f"{slide}.json")
        process_with_alignment(tts_path, out_path)
    elif fname.endswith(".mp3"):
        slide = fname.replace(".mp3", "")
        if slide in seen:
            continue
        # Only use mp3 fallback if no .tts.json exists
        tts_path = os.path.join(NARRATION_DIR, f"{slide}.tts.json")
        if os.path.exists(tts_path):
            continue
        seen.add(slide)
        mp3_path = os.path.join(NARRATION_DIR, fname)
        out_path = os.path.join(NARRATION_DIR, f"{slide}.json")
        process_mp3_only(mp3_path, out_path)

# Clean up old combined file
combined = os.path.join(NARRATION_DIR, "payloads.json")
if os.path.exists(combined):
    os.remove(combined)
    print(f"Removed {combined}")

print("Done.")
