#!/usr/bin/env python3
"""Generate get-ready-with-me video using bytedance/seedance-2.0 via Replicate API."""

import os
import sys
import time
import json
import urllib.request
import urllib.parse

API_KEY = "r8_IlVoc4ZRZNXKRtOdnuEZeJI5w8KVLdr3hxxsX"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "assets", "seedance-grtm.mp4")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Prefer": "wait",
}

PROMPT = (
    "Close-up 'get ready with me' social media video of a stylish woman in her mid-20s "
    "carefully applying black liquid eyeliner with a precision brush, ring light glowing in her eyes, "
    "aesthetic vanity mirror with soft warm lighting, casual bedroom setup, "
    "she speaks casually in a bored valley girl drawl directly to camera: "
    "\"The best startups in emerging categories often act as Narrative Schelling Points. "
    "We are on the verge of a new category. generative media.\", "
    "subtle lo-fi chill background music, soft ambient room sounds, "
    "vertical smartphone aesthetic, cinematic soft bokeh background"
)


def _request(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"HTTP {e.code}: {body}", file=sys.stderr)
        raise


def main():
    print("Submitting prediction to Replicate (bytedance/seedance-2.0)...")

    pred = _request("POST", "https://api.replicate.com/v1/models/bytedance/seedance-2.0/predictions", {
        "input": {
            "prompt": PROMPT,
            "duration": 10,
            "resolution": "720p",
            "aspect_ratio": "9:16",
            "generate_audio": True,
        }
    })

    pred_id = pred["id"]
    print(f"Prediction ID: {pred_id}")
    print(f"Status: {pred.get('status')}")

    # Poll until done
    while pred.get("status") not in ("succeeded", "failed", "canceled"):
        time.sleep(5)
        pred = _request("GET", f"https://api.replicate.com/v1/predictions/{pred_id}")
        elapsed = pred.get("metrics", {}).get("predict_time", "?")
        print(f"Status: {pred.get('status')} | elapsed: {elapsed}s")

    if pred["status"] != "succeeded":
        print(f"Generation failed: {pred.get('error')}", file=sys.stderr)
        sys.exit(1)

    output_url = pred["output"]
    print(f"Output URL: {output_url}")

    # Download video
    print(f"Downloading to {OUTPUT_PATH}...")
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    urllib.request.urlretrieve(output_url, OUTPUT_PATH)
    size_mb = os.path.getsize(OUTPUT_PATH) / 1_000_000
    print(f"Done! Saved {size_mb:.2f}MB to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
