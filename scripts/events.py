"""Shared sync events (frames @30fps) -> src/sync-events.json.

Picture (src/lib/sync.ts) and audio (scripts/sfx.py) both read this file, so sips, the last drip,
the thirst alarm, the headache throbs, heartbeats, the day stamps and the kidney shutdown always
line up. Also copies the narration word timings in as "words" {lineId: [{w, f}]} and the HUD
curves (hours without water, % water lost) from timeline.json.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src" / "timeline.json").read_text(encoding="utf-8"))
NARR = json.loads((ROOT / "src" / "narration.json").read_text(encoding="utf-8"))
FPS = TL["fps"]
TOTAL = TL["total"]
M = TL["marks"]
AT = {s["id"]: s["at"] for s in TL["scenes"]}


def sips():
    """S01: his gulps from the glass (throat bobs, water level drops) on 'This is the last sip'."""
    return [24, 40]


def drips():
    """S02: the tap's final drips; the LAST one hits the counter / empty glass on 'single drop'."""
    return [112, 140, M["singleDrop"][0] + 8]


def alarms():
    """S05: the brain's thirst alarm rings (hypothalamus flashes) on 'sounds the alarm. Thirst.'"""
    return [M["alarm"], M["alarm"] + 12, M["thirst"]]


def throbs():
    """S07: his headache pounding (temple throb) on 'your head pounds'."""
    return [815, 829, 843]


def beats():
    """Heartbeats (the 'lub' frame) — S08: ~75 -> ~115 bpm as the blood thickens ('pump faster');
    S15: racing ~140 bpm, then irregular stumbles after 'stumbles'; S16: slow, fading, then none."""
    out = []
    # S08
    f, bpm = float(AT["S08"] - 4), 75.0
    while f < AT["S09"] + 4:
        out.append(int(round(f)))
        bpm = min(120.0, bpm + 9.0)
        f += 1800.0 / bpm  # frames per beat at 30 fps
    # S15: racing, then stumbling
    f = float(AT["S15"] - 6)
    while f < M["stumbles"]:
        out.append(int(round(f)))
        f += 1800.0 / 140.0
    out += [M["stumbles"] + 1, M["stumbles"] + 7, M["stumbles"] + 22]  # beat-beat ... beat
    # S16: a few slow faint beats while he drifts, then they stop before 'stops'
    for f2 in (1660, 1690, 1722):
        out.append(f2)
    return sorted(set(out))


def stamps():
    """The 'DAY 1 / DAY 2 / DAY 3' clock-wipe stamps (HUD flips + a clock chime)."""
    return [M["dayOne"], M["dayTwo"], M["dayThree"]]


def shutdown():
    """S14: the kidneys stop filtering ('shut down')."""
    return [M["kidneysShut"][0] + 15]


def gulps():
    """S19: water pouring down the x-ray throat and refilling the body, one gulp at a time."""
    return [1996, 2012, 2028, 2044, 2060]


def main():
    words = {n["id"]: [{"w": w["w"], "f": w["f"]} for w in n.get("words", [])] for n in NARR}
    out = {
        "fps": FPS,
        "total": TOTAL,
        "sips": sips(),
        "drips": drips(),
        "alarms": alarms(),
        "throbs": throbs(),
        "beats": beats(),
        "stamps": stamps(),
        "shutdown": shutdown(),
        "gulps": gulps(),
        "hours": TL["hours"],
        "lostPerHour": TL["lostPerHour"],
        "hud": TL["hud"],
        "marks": M,
        "words": words,
    }
    (ROOT / "src" / "sync-events.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(", ".join(f"{k} {len(v)}" for k, v in out.items() if isinstance(v, list)))


if __name__ == "__main__":
    main()
