"""Narration: edge-tts lines -> public/audio/narr/*.mp3 (+ 48k wav) and src/narration.json.

Start times are authored here (seconds on the master timeline); durations are measured.
Re-run after editing a line: only changed/missing lines are re-synthesised.
"""
import asyncio, json, subprocess, sys, hashlib
from pathlib import Path

import edge_tts
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio" / "narr"
FFMPEG = ROOT / "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"
FFPROBE = ROOT / "node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe"
VOICE = "en-US-AndrewNeural"
RATE = "+10%"
PITCH = "-2Hz"

# (id, start seconds, text)
LINES = [
    ("n01", 0.30, "This is the last sip of water you will ever drink."),
    ("n02", 3.05, "No water. No juice. Not a single drop, ever again."),
    ("n03", 6.85, "So how long would you last?"),
    ("n04", 8.55, "Your body is about sixty percent water, and it's always leaking out."),
    ("n05", 12.40, "With every breath, every bead of sweat, every trip to the bathroom."),
    ("n06", 16.55, "A few hours in, your blood gets saltier. Your brain sounds the alarm. Thirst."),
    ("n07", 21.30, "Your kidneys start hoarding every drop. Your pee turns dark."),
    ("n08", 24.95, "Day one. Your mouth is sticky, your head pounds, and you can't think straight."),
    ("n09", 29.40, "Your blood thickens, so your heart has to pump faster."),
    ("n10", 32.70, "Day two. Your body pulls water out of your cells, and they shrivel."),
    ("n11", 36.70, "Your skin loses its bounce. Your eyes sink."),
    ("n12", 39.50, "You stop sweating, so you start to overheat."),
    ("n13", 42.10, "Stand up, and the whole room spins."),
    ("n14", 44.35, "Even your brain shrinks. Your thoughts turn to fog."),
    ("n15", 47.45, "Day three. Your kidneys shut down. Poisons build up in your blood."),
    ("n16", 51.30, "Your blood pressure crashes. Your heart races, then stumbles."),
    ("n17", 55.00, "You drift in and out... until your body simply stops."),
    ("n18", 59.50, "Your whole lifetime, without water? About three days."),
    ("n19", 63.10, "Now rewind."),
    ("n20", 66.40, "You lose about two and a half litres of water every day. Your body needs it back."),
    ("n21", 71.00, "So do yourself a favour. Go drink a glass of water."),
]


def trim_silence(src: Path, dst: Path, thresh_db=-48.0, pad=0.06) -> float:
    """Trim leading/trailing silence; returns the seconds cut from the start (to shift word times)."""
    x, sr = sf.read(str(src), dtype="float32")
    env = np.abs(x)
    th = 10 ** (thresh_db / 20)
    idx = np.nonzero(env > th)[0]
    a = max(0, idx[0] - int(0.02 * sr)) if len(idx) else 0
    b = min(len(x), idx[-1] + int(0.05 * sr)) if len(idx) else len(x)
    y = x[a:b]
    fade = int(0.008 * sr)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    y = np.concatenate([y, np.zeros(int(pad * sr), np.float32)])
    sf.write(str(dst), y, sr, subtype="PCM_16")
    return a / sr


def probe(p: Path) -> float:
    r = subprocess.run([str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(p)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


async def synth(text: str, mp3: Path) -> list:
    """Synthesise to mp3; returns word boundaries [{w, t, d}] (seconds from the raw audio start)."""
    for attempt in range(6):
        try:
            words, audio = [], bytearray()
            async for ch in edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary").stream():
                if ch["type"] == "audio":
                    audio += ch["data"]
                elif ch["type"] == "WordBoundary":
                    words.append({"w": ch["text"], "t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7})
            mp3.write_bytes(bytes(audio))
            if mp3.stat().st_size > 2000:
                return words
        except Exception as e:  # NoAudioReceived etc. are transient
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
        await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"edge-tts failed for {mp3.name}")


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cache_f = OUT / "_cache.json"
    cache = json.loads(cache_f.read_text(encoding="utf-8")) if cache_f.exists() else {}
    words_f = OUT / "_words.json"
    words_all = json.loads(words_f.read_text(encoding="utf-8")) if words_f.exists() else {}
    manifest = []
    for lid, start, text in LINES:
        key = hashlib.md5(f"{VOICE}|{RATE}|{PITCH}|{text}".encode()).hexdigest()
        mp3, wav = OUT / f"{lid}.mp3", OUT / f"{lid}.wav"
        if cache.get(lid) != key or not mp3.exists() or lid not in words_all:
            print(f"tts {lid}: {text}")
            words = await synth(text, mp3)
            # decode -> numpy trim of edge-tts leading/trailing silence -> 48k mono wav
            raw = OUT / f"{lid}_raw.wav"
            subprocess.run([str(FFMPEG), "-y", "-v", "error", "-i", str(mp3), "-ar", "48000", "-ac", "1",
                            str(raw)], check=True)
            lead = trim_silence(raw, wav)
            words_all[lid] = [{"w": w["w"], "t": round(w["t"] - lead, 3), "d": round(w["d"], 3)} for w in words]
            raw.unlink()
            subprocess.run([str(FFMPEG), "-y", "-v", "error", "-i", str(wav), "-b:a", "192k",
                            str(mp3)], check=True)
            cache[lid] = key
        dur = probe(wav)
        manifest.append({"id": lid, "start": start, "dur": round(dur, 3), "text": text,
                         "words": [{"w": w["w"], "at": round(start + w["t"], 3), "f": round((start + w["t"]) * 30)}
                                   for w in words_all[lid]]})
    cache_f.write_text(json.dumps(cache, indent=1), encoding="utf-8")
    words_f.write_text(json.dumps(words_all, indent=1), encoding="utf-8")
    (ROOT / "src" / "narration.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    prev_end = 0.0
    for m in manifest:
        end = m["start"] + m["dur"]
        gap = m["start"] - prev_end
        flag = "  <-- OVERLAP" if gap < 0.15 else ""
        print(f"{m['id']}  {m['start']:6.2f} -> {end:6.2f}  ({m['dur']:.2f}s, gap {gap:+.2f}){flag}  {m['text']}")
        prev_end = end


if __name__ == "__main__":
    asyncio.run(main())
