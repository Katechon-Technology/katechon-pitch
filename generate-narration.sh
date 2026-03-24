#!/usr/bin/env bash
# Generate narration audio for each slide using ElevenLabs API
# Voice: jqcCZkN6Knx8BJ5TBdYR (same as claudetorio)
# Model: eleven_turbo_v2

set -euo pipefail

API_KEY="${ELEVENLABS_API_KEY:-sk_b035bf59a591b7e17c819161a07303c1ab6a5c17a3ef33ea}"
VOICE_ID="jqcCZkN6Knx8BJ5TBdYR"
MODEL_ID="eleven_turbo_v2"
OUT_DIR="assets/narration"

mkdir -p "$OUT_DIR"

# Use with-timestamps endpoint for character-level alignment (lip sync)

declare -a NARRATIONS=(
  # Slide 0: Title
  "Katechon Technology. Real-time content generation."

  # Slide 1: Compare
  "Consider two worlds. Traditional media: high trust, but low volume and limited channels. Social media: massive content, but low trust and siloed platforms. Neither gives us both."

  # Slide 2: Question
  "So the question becomes: how do we build information channels that are both trustworthy and infinitely scalable?"

  # Slide 3: Generative Media
  "The answer is generative media. Variable trust that can be tuned and verified. High content throughput. And delivery across multiple channels simultaneously."

  # Slide 4: The Stack
  "Here's how we build it. APIs feed real-time data. Avatar and narration layers bring it to life. Markets and predictions add interactivity. Everything synthesizes into a live stream — whether that's an AI war correspondent, a Factorio tournament, or an autonomous news network."

  # Slide 5: Video Demo
  "Here's a quick demo of what this looks like in practice."

  # Slide 6: Vision
  "We are building a platform for infinite, customizable, and trusted content generation."

  # Slide 7: Browser Era
  "Think about the evolution of media. First, everything was built around the HTML page and text. Then came video and photo files. What's next? Everything will be built around the browser itself — streamed as an interactive overlay."

  # Slide 8: Evolution
  "What starts as a simple question — how can we live stream an AI playing video games — becomes the next evolution of media on the internet."

  # Slide 9: Media Definition
  "This is how we define the new media landscape."

  # Slide 10: Monetization
  "Three revenue streams. Betting fees from prediction markets on AI model performance. API access where AI labs pay for benchmarking infrastructure. And content licensing from our livestream data."

  # Slide 11: Status / Ask
  "Where are we now? Our first prototype, Claudetorio, is already live. The platform is in active development. And we're meeting investors, AI researchers, and labs in London, NYC, and SF. We're raising a seed round to scale from prototype to full platform launch."

  # Slide 12: Founder
  "Simon Judd, founder. On the tech side: engineer at Ingonyama, a leading cryptography company. ZK Hack winner. Independent research in interactive proof systems at EPFL. On the business side: raised ten million from S-tier investors while still in business school. Helped grow Index Coop from five million to five hundred million in assets under management. And a former infantry officer in the United States Marine Corps."

  # Slide 13: Closing
  "Katechon Technology. Let's talk."
)

for i in "${!NARRATIONS[@]}"; do
  TTS_FILE="$OUT_DIR/slide-${i}.tts.json"
  MP3_FILE="$OUT_DIR/slide-${i}.mp3"

  if [ -f "$TTS_FILE" ]; then
    echo "Slide $i: .tts.json exists, skipping"
    continue
  fi
  echo "Slide $i: generating with timestamps..."

  TEXT="${NARRATIONS[$i]}"

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

  # Extract MP3 from JSON response for preview/fallback
  python3 -c "
import json, base64
with open('$TTS_FILE') as f:
    d = json.load(f)
with open('$MP3_FILE', 'wb') as f:
    f.write(base64.b64decode(d['audio_base64']))
"

  echo "Slide $i: done ($(du -h "$TTS_FILE" | cut -f1) json, $(du -h "$MP3_FILE" | cut -f1) mp3)"
done

echo ""
echo "All narration files generated in $OUT_DIR/"
ls -la "$OUT_DIR/"
