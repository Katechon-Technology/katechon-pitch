#!/usr/bin/env bash
# Generate narration audio per slide using ElevenLabs with-timestamps API.
# Output files are keyed by slide.id (matches deck.js fetch path).
# Voice: jqcCZkN6Knx8BJ5TBdYR   Model: eleven_turbo_v2
#
# Usage:
#   ./generate-narration.sh                 # regenerate only missing
#   ./generate-narration.sh --force         # regenerate everything
#   ./generate-narration.sh --only <slug>   # regenerate just one slide (forced)

set -euo pipefail

API_KEY="${ELEVENLABS_API_KEY:-sk_b035bf59a591b7e17c819161a07303c1ab6a5c17a3ef33ea}"
VOICE_ID="jqcCZkN6Knx8BJ5TBdYR"
MODEL_ID="eleven_turbo_v2"
OUT_DIR="assets/narration"
FORCE=0
ONLY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    --only)  ONLY="${2:-}"; FORCE=1; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

mkdir -p "$OUT_DIR"

# slug | narration  (keep in sync with src/slides/<slug>/index.js)
NARRATIONS=(
  "evolution|Broadcast made us viewers, then social made us creators — each wave invisible from inside the one before. The third is forming now, and watching is about to become doing."
  "tension|To act on a single headline today, you leave the stream — four apps, twelve clicks, and the world has already moved. The interface hasn't caught up to the world it shows you."
  "genmedia|Generative AI and the open rails of the blockchain make the next medium possible — channels aware of context, generated on demand, wired to execute. Consumption and action collapse into a single surface."
  "stack|Cheap simulation runs headless; high-fidelity rendering only spins up when a viewer tunes in. We're starting with a single open source, 24-hour interactive live stream — and the same architecture scales to thousands of channels."
  "vision|We are building the first 24-hour interactive livestream — a platform where consumption and action are the same act. Watching becomes doing."
  "ask|We're starting with the traders and analysts who need this first — the interactive livestream comes for everyone else next. We're raising our seed round; get in."
)

for entry in "${NARRATIONS[@]}"; do
  SLUG="${entry%%|*}"
  TEXT="${entry#*|}"

  if [[ -n "$ONLY" && "$SLUG" != "$ONLY" ]]; then
    continue
  fi

  TTS_FILE="$OUT_DIR/${SLUG}.tts.json"
  MP3_FILE="$OUT_DIR/${SLUG}.mp3"

  # Old id-slug symlinks pointed at slide-N.json; drop them before writing real files.
  if [ -L "$OUT_DIR/${SLUG}.json" ]; then
    rm "$OUT_DIR/${SLUG}.json"
  fi

  if [ -f "$TTS_FILE" ] && [ $FORCE -eq 0 ]; then
    echo "[$SLUG] .tts.json exists, skipping (use --force to regen)"
    continue
  fi
  echo "[$SLUG] generating..."

  curl -s -X POST \
    "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps" \
    -H "xi-api-key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg text "$TEXT" \
      --arg model "$MODEL_ID" \
      '{
        text: $text,
        model_id: $model,
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      }')" \
    --output "$TTS_FILE"

  # ElevenLabs returns JSON with {audio_base64, alignment, ...} on success
  # or {"detail": ...} on error — sanity check before continuing.
  if ! jq -e '.audio_base64' "$TTS_FILE" >/dev/null 2>&1; then
    echo "[$SLUG] ERROR: response did not contain audio_base64"
    cat "$TTS_FILE"
    exit 1
  fi

  python3 -c "
import json, base64
with open('$TTS_FILE') as f: d = json.load(f)
with open('$MP3_FILE', 'wb') as f: f.write(base64.b64decode(d['audio_base64']))
"
  echo "[$SLUG] done ($(du -h "$TTS_FILE" | cut -f1) tts, $(du -h "$MP3_FILE" | cut -f1) mp3)"
done

echo
echo "Now run: /tmp/narration-env/bin/python precompute-narration.py"
