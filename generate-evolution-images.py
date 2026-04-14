#!/usr/bin/env python3
"""
Generate the 9 evolution-of-media images via Replicate API.
Images are saved to assets/evolution/ and referenced by the slide deck.

Usage:
  python3 generate-evolution-images.py

Model is configurable below — default is black-forest-labs/flux-schnell.
"""
import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
MODEL = "google/nano-banana-pro"
# Swap MODEL above if you have a specific Replicate model (owner/model-name)

OUTPUT_DIR = Path(__file__).parent / "assets" / "evolution"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Read API key from env or .env.local
API_KEY = os.environ.get("REPLICATE_API_KEY", "")
if not API_KEY:
    env_path = Path(__file__).parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REPLICATE_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip().strip('"')
                break

if not API_KEY:
    raise SystemExit("REPLICATE_API_KEY not found. Set it in .env.local or env.")

# ── Prompts — 9 images (3 rows × 3 eras) ─────────────────────────────────────
IMAGES = [
    # Row 1 — Video evolution
    ("tv",
     "Vintage 1950s cathode-ray television set, glowing amber CRT screen, dark studio pedestal, "
     "cinematic product photography, dramatic chiaroscuro lighting, ultra-sharp, isolated on "
     "dark background, warm tube glow, 4K detail"),

    ("youtube",
     "YouTube red play-button logo on a sleek smartphone screen glowing in deep darkness, "
     "thumbnail grid of colorful video cards, dark background, editorial product photography, "
     "soft cinematic ambient light, high contrast"),

    ("ai-video",
     "Photorealistic synthetic AI news anchor face on a holographic broadcast screen in a "
     "dark futuristic studio, perfect digital human, neon-blue emission, cinematic 4K, "
     "deep blacks, hyper-detailed portrait"),

    # Row 2 — News evolution
    ("newspaper",
     "Stack of vintage broadsheet newspapers with bold black ink headlines, dramatic noir "
     "chiaroscuro lighting, dark oak surface, moody editorial still-life photography, "
     "deep shadows, cinematic composition"),

    ("twitter",
     "Twitter X bird logo glowing on a dark-mode smartphone screen, minimalist tweet feed, "
     "dark background, blue ambient light, editorial product photography, "
     "high-contrast, clean composition"),

    ("ai-news",
     "Autonomous AI journalist holographic avatar on a dark broadcast display, synthetic "
     "anchor face, futuristic newsroom, neon-orange accent glow, cinematic wide shot, "
     "dark atmosphere, ultra-detailed"),

    # Row 3 — Photo/magazine evolution
    ("magazine",
     "Stack of glossy luxury fashion magazine covers on dark surface, bold editorial "
     "typography, rich saturated photography, premium print aesthetic, dark dramatic studio "
     "backdrop, cinematic product still-life"),

    ("instagram",
     "Instagram photo grid on a sleek smartphone screen, aesthetic dark-mode UI, curated "
     "high-quality lifestyle thumbnails, screen glow, dark background, editorial photography, "
     "clean minimal composition"),

    ("ai-photo",
     "AI-generated hyperrealistic portrait photograph, flawless synthetic human face, "
     "perfect studio lighting, seamless dark background, uncanny precision, "
     "photorealistic digital art, ultra-detailed"),
]

# ── API helpers ───────────────────────────────────────────────────────────────
BASE_HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

def _request(method, url, data=None, extra_headers=None):
    body = json.dumps(data).encode() if data else None
    req  = urllib.request.Request(url, data=body, method=method)
    for k, v in BASE_HEADERS.items():
        req.add_header(k, v)
    if extra_headers:
        for k, v in extra_headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())

def _download(url, dest):
    urllib.request.urlretrieve(url, dest)

# ── Generator ─────────────────────────────────────────────────────────────────
def generate(slug, prompt):
    out = OUTPUT_DIR / f"{slug}.jpg"
    if out.exists():
        print(f"  skip   {slug} (already exists)")
        return True

    print(f"  gen    {slug} ...", end="", flush=True)

    try:
        pred = _request(
            "POST",
            f"https://api.replicate.com/v1/models/{MODEL}/predictions",
            data={
                "input": {
                    "prompt": prompt,
                    "width": 768,
                    "height": 768,
                    "num_outputs": 1,
                    "output_format": "jpg",
                    "output_quality": 92,
                }
            },
            extra_headers={"Prefer": "wait"},
        )
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f" HTTP {e.code}: {body[:300]}")
        return False

    # Poll if not synchronously completed
    while pred.get("status") not in ("succeeded", "failed", "canceled"):
        time.sleep(2)
        pred = _request("GET", f"https://api.replicate.com/v1/predictions/{pred['id']}")
        print(".", end="", flush=True)

    if pred["status"] != "succeeded":
        print(f" FAILED: {pred.get('error')}")
        return False

    output  = pred["output"]
    img_url = output[0] if isinstance(output, list) else output
    _download(img_url, out)
    kb = out.stat().st_size // 1024
    print(f" done ({kb}KB)")
    return True

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Evolution image generator")
    print(f"Model : {MODEL}")
    print(f"Output: {OUTPUT_DIR}\n")

    succeeded = 0
    for slug, prompt in IMAGES:
        if generate(slug, prompt):
            succeeded += 1

    print(f"\n{succeeded}/{len(IMAGES)} images generated.")
