#!/usr/bin/env python3
"""Generate evolution slide images via Replicate bytedance/hyper-flux-16step."""

import os, time, json, urllib.request, urllib.error

API_TOKEN = os.environ.get("REPLICATE_API_TOKEN") or open(
    os.path.join(os.path.dirname(__file__), "../.env")
).read().split("REPLICATE_API_TOKEN=")[1].strip()

MODEL_VERSION = "382cf8959fb0f0d665b26e7e80b8d6dc3faaef1510f14ce017e8c732bb3d1eb7"
OUT_DIR = os.path.join(os.path.dirname(__file__), "../assets/evolution")

STYLE = (
    "ultra-detailed graphic novel illustration, TinTin ligne claire meets anime action, "
    "OSINT cyber-intel aesthetic, dramatic composition, high contrast, "
    "vivid saturated colors on dark background, dynamic action energy"
)

IMAGES = [
    ("tv.jpg", "ACTION SCENE: Cold War bunker analyst electrified by a massive cathode ray television, "
     "sparks exploding from the screen, papers flying, urgent crisis moment, "
     "TinTin-style ligne claire linework, atomic-era government intelligence room, "
     "dramatic diagonal shadows, black ink hatching, man leaping toward the screen in awe and terror"),

    ("youtube.jpg", "ACTION SCENE: anime vtuber girl mid-air jump, ring light halo behind her like a sun, "
     "red play buttons detonating like bombs across the frame, notification bells raining down, "
     "RGB streaming setup in extreme perspective, manga speed lines radiating outward, "
     "neon bedroom cyberpunk, saturated explosive color, digital fame erupting into existence"),

    ("ai-video.jpg", "ACTION SCENE: humanoid AI avatar fragmenting and reconstructing itself as pure moving image, "
     "100 simultaneous video feeds orbiting it like moons, OSINT terminal overlays and signal intercepts, "
     "glitch art body dissolving into fiber optic light, emergence from digital void, "
     "cyberpunk hyper-detail, information deity being born from noise"),

    ("newspaper.jpg", "ACTION SCENE: TinTin-style ace reporter sprinting through 1940s wartime city, "
     "hat flying off mid-run, newspaper printing press exploding ink behind him, "
     "breaking headlines floating like shrapnel, noir chiaroscuro shadows, "
     "ink splatter motion blur, urgent graphic novel panel energy, "
     "reporter clutching scoop paper while city burns"),

    ("twitter.jpg", "ACTION SCENE: anime character surfing on a tsunami of tweets, "
     "phone erupting like a volcano of notifications, blue bird morphing mid-air into an X, "
     "thousands of replies falling like digital rain around them, "
     "OSINT satellite map in background, hyper-kinetic manga composition, "
     "information warfare aesthetic, scrolling as combat"),

    ("ai-news.jpg", "ACTION SCENE: AI oracle avatar materializing from a vortex of global signals, "
     "SIGINT intercepts and satellite feeds spiraling inward into its forming face, "
     "neural network tendrils reaching across a world map, "
     "dramatic emergence from pure data, hyper-detailed OSINT terminal aesthetic, "
     "information deity of the machine age, electric summoning"),

    ("magazine.jpg", "ACTION SCENE: TinTin-inspired wartime photojournalist in dramatic combat crouch, "
     "large format camera aimed directly at viewer like a weapon, "
     "explosion blooming behind them in black and white ink wash, "
     "photographic plates flying like shrapnel, editorial magazine cover energy, "
     "graphic novel panel composition, high contrast linework, decisive moment captured mid-action"),

    ("instagram.jpg", "ACTION SCENE: anime influencer in explosive rooftop golden hour action pose, "
     "camera drone circling like a hawk overhead, cherry blossoms and neon cityscape behind, "
     "holographic follower counter skyrocketing upward like a rocket, "
     "phone raised triumphantly like a katana, vtuber aesthetic, "
     "cinematic widescreen crop, saturated magic hour light, digital fame as power"),

    ("ai-photo.jpg", "ACTION SCENE: AI artist avatar conjuring photorealistic portals from raw imagination, "
     "twelve floating frames of generated realities materializing around outstretched hands, "
     "images within images within images, creative explosion like a big bang, "
     "OSINT coordinate overlays, digital painterly aesthetic, "
     "god-mode creation scene, every pixel a new universe being born"),
]

def replicate_post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"https://api.replicate.com/v1/{path}",
        data=data,
        headers={"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def replicate_get(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {API_TOKEN}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def wait_for_output(prediction):
    poll_url = prediction["urls"]["get"]
    while True:
        pred = replicate_get(poll_url)
        status = pred["status"]
        if status == "succeeded":
            return pred["output"][0] if isinstance(pred["output"], list) else pred["output"]
        if status in ("failed", "canceled"):
            raise RuntimeError(f"Prediction {status}: {pred.get('error')}")
        print(f"  [{status}] waiting…")
        time.sleep(3)

def download(url, dest):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
        f.write(r.read())

os.makedirs(OUT_DIR, exist_ok=True)

for filename, prompt in IMAGES:
    full_prompt = f"{prompt}. {STYLE}"
    dest = os.path.join(OUT_DIR, filename)
    print(f"\n→ Generating {filename}…")

    pred = replicate_post("predictions", {
        "version": MODEL_VERSION,
        "input": {
            "prompt": full_prompt,
            "num_outputs": 1,
            "aspect_ratio": "1:1",
            "output_format": "jpg",
            "output_quality": 95,
            "num_inference_steps": 16,
            "guidance_scale": 3.5,
        }
    })

    img_url = wait_for_output(pred)
    download(img_url, dest)
    print(f"  ✓ saved → {dest}")

print("\nAll 9 images generated.")
