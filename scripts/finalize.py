"""Mastering + mux (run after the lead renders):

    npm run render   -> out/no-water.mp4       (video; its own audio track is ignored)
    npm run mix      -> out/no-water-mix.wav   (lossless Remotion mix: VO + sfx + music)
    python scripts/finalize.py

1. measure the mix (pyloudnorm, BS.1770 integrated LUFS; 4x-oversampled true peak)
2. static gain to -14 LUFS integrated
3. numpy look-ahead peak limiter (5 ms look-ahead, smooth exponential release, linked stereo,
   4x-oversampled true-peak detection) to -1.0 dBTP; gain/limit iterated so the result lands on
   target after limiting
4. write out/no-water-master.wav (48 kHz stereo 24-bit)
5. mux with Remotion's bundled ffmpeg: video stream copy + AAC 320k 48 kHz, -shortest, +faststart
   -> out/no-water-final.mp4; decode the AAC back and re-measure (one automatic retry with
   a lower ceiling if the AAC overshoots the true-peak ceiling by > 0.2 dB)

All DSP is numpy/scipy (the bundled ffmpeg has no alimiter/loudnorm). Paths can be overridden:
    python scripts/finalize.py --video X.mp4 --mix Y.wav --master M.wav --out Z.mp4
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d

ROOT = Path(__file__).resolve().parent.parent
BIN = ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc"
FFMPEG = BIN / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
FFPROBE = BIN / ("ffprobe.exe" if sys.platform == "win32" else "ffprobe")
SR = 48000


# ------------------------------------------------------------------------------------------------
def true_peak_env(x: np.ndarray, os: int = 4) -> np.ndarray:
    """Per-sample max |x| over channels including inter-sample peaks (4x polyphase oversampling)."""
    n = x.shape[0]
    y = signal.resample_poly(x, os, 1, axis=0)
    a = np.max(np.abs(y[: n * os]), axis=1).reshape(n, os).max(axis=1)
    return np.maximum(a, np.max(np.abs(x), axis=1))


def true_peak_db(x: np.ndarray) -> float:
    return float(20 * np.log10(np.max(true_peak_env(x)) + 1e-20))


def causal_box(x: np.ndarray, m: int) -> np.ndarray:
    c = np.cumsum(np.concatenate([np.zeros(m), x]))
    return (c[m:] - c[:-m]) / m


def limiter(x: np.ndarray, ceiling_db: float, lookahead: float = 0.005, release: float = 0.08):
    """Look-ahead brickwall limiter. Returns (y, gain_reduction_db_per_sample).

    gr_req = dB the (oversampled) peak exceeds the ceiling. The reduction is (1) held over the
    next L samples (forward max -> gain is fully down L samples before each peak), (2) given an
    exponential release (peak-hold-decay, vectorised in the log domain), (3) smoothed by two
    causal L/2 box filters (total support < L, so every peak still gets >= its required
    reduction while the attack becomes an S-curve, no clicks)."""
    L = max(2, int(round(lookahead * SR)))
    pk = true_peak_env(x)
    gr = np.maximum(0.0, 20 * np.log10(np.maximum(pk, 1e-12)) - ceiling_db)
    if not np.any(gr > 0):
        return x.copy(), np.zeros(len(x))
    grf = maximum_filter1d(gr, size=L, origin=-(L // 2))  # max over [n, n+L-1]
    # release: e[n] = max(grf[n], e[n-1]*a), a = exp(-c)  ->  log e[n] = max_k(log grf[k] + k c) - n c
    c = 1.0 / (release * SR)
    k = np.arange(len(grf), dtype=np.float64)
    with np.errstate(divide="ignore"):
        u = np.where(grf > 0, np.log(np.maximum(grf, 1e-300)), -np.inf) + k * c
    e = np.exp(np.maximum.accumulate(u) - k * c)
    e = np.maximum(e, grf)
    m = L // 2
    s = causal_box(causal_box(e, m), m)
    g = 10 ** (-s / 20)
    return x * g[:, None], s


def lufs(meter, x) -> float:
    return float(meter.integrated_loudness(x))


def master(x: np.ndarray, target: float, ceiling: float, log=print):
    meter = pyln.Meter(SR)
    l0, tp0 = lufs(meter, x), true_peak_db(x)
    gain = float(np.clip(target - l0, -30, 30))
    ceil_int = ceiling - 0.1
    y, gr = x, np.zeros(len(x))
    for it in range(6):
        y, gr = limiter(x * 10 ** (gain / 20), ceil_int)
        l1, tp1 = lufs(meter, y), true_peak_db(y)
        log(f"    pass {it + 1}: gain {gain:+.2f} dB, limiter ceiling {ceil_int:.2f} -> {l1:.2f} LUFS, "
            f"{tp1:.2f} dBTP, max GR {gr.max():.2f} dB")
        if tp1 > ceiling:
            ceil_int -= (tp1 - ceiling) + 0.05
            continue
        if abs(l1 - target) <= 0.1:
            break
        gain += target - l1
    return y, dict(lufs_in=l0, tp_in=tp0, gain=gain, lufs_out=lufs(meter, y), tp_out=true_peak_db(y),
                   gr_max=float(gr.max()), gr_pct=float(np.mean(gr > 0.1) * 100))


# ------------------------------------------------------------------------------------------------
def run(cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"command failed ({r.returncode}): {' '.join(map(str, cmd))}\n{r.stderr[-3000:]}")
    return r


def aac_encoder() -> str:
    r = run([FFMPEG, "-hide_banner", "-encoders"])
    return "libfdk_aac" if "libfdk_aac" in r.stdout else "aac"


def probe_dur(path: Path, stream: str) -> float:
    r = run([FFPROBE, "-v", "error", "-select_streams", stream, "-show_entries", "stream=duration",
             "-of", "default=nw=1:nk=1", path])
    try:
        return float(r.stdout.strip().splitlines()[0])
    except (ValueError, IndexError):
        return float("nan")


def mux(video: Path, wav: Path, out: Path, bitrate: str):
    enc = aac_encoder()
    run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-i", wav,
         "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", enc, "-b:a", bitrate,
         "-ar", str(SR), "-ac", "2", "-shortest", "-movflags", "+faststart", out])
    return enc


def decode_audio(mp4: Path) -> np.ndarray:
    with tempfile.TemporaryDirectory() as td:
        w = Path(td) / "dec.wav"
        run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", mp4, "-vn", "-c:a", "pcm_s24le",
             "-ar", str(SR), w])
        y, _ = sf.read(str(w), dtype="float64", always_2d=True)
    return y


def load_mix(path: Path) -> np.ndarray:
    x, sr = sf.read(str(path), dtype="float64", always_2d=True)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    x = x[:, :2]
    if sr != SR:
        g = np.gcd(sr, SR)
        x = signal.resample_poly(x, SR // g, sr // g, axis=0)
    return x


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", default=str(ROOT / "out" / "no-water.mp4"))
    ap.add_argument("--mix", default=str(ROOT / "out" / "no-water-mix.wav"))
    ap.add_argument("--master", default=str(ROOT / "out" / "no-water-master.wav"))
    ap.add_argument("--out", default=str(ROOT / "out" / "no-water-master.mp4"))
    ap.add_argument("--target", type=float, default=-14.0, help="integrated LUFS")
    ap.add_argument("--ceiling", type=float, default=-1.0, help="true-peak ceiling dBTP")
    ap.add_argument("--bitrate", default="320k")
    ap.add_argument("--no-mux", action="store_true", help="only write the master wav")
    a = ap.parse_args()
    video, mixp, masterp, outp = (Path(p).resolve() for p in (a.video, a.mix, a.master, a.out))

    if not mixp.exists():
        raise SystemExit(f"mix not found: {mixp}  (run `npm run mix` first)")
    if not a.no_mux and not video.exists():
        raise SystemExit(f"video not found: {video}  (run `npm run render` first)")
    if not FFMPEG.exists():
        raise SystemExit(f"bundled ffmpeg not found: {FFMPEG}")

    x = load_mix(mixp)
    print(f"mix    {mixp}  ({len(x) / SR:.3f} s, {x.shape[1]} ch, {SR} Hz)")
    ceiling = a.ceiling
    for attempt in range(2):
        print(f"mastering to {a.target:.1f} LUFS / {ceiling:.2f} dBTP")
        y, st = master(x, a.target, ceiling)
        masterp.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(masterp), y, SR, subtype="PCM_24")
        print(f"BEFORE {st['lufs_in']:7.2f} LUFS  {st['tp_in']:6.2f} dBTP")
        print(f"AFTER  {st['lufs_out']:7.2f} LUFS  {st['tp_out']:6.2f} dBTP   (static gain {st['gain']:+.2f} dB, "
              f"limiter max {st['gr_max']:.2f} dB, active on {st['gr_pct']:.2f}% of samples)")
        print(f"master {masterp}")
        if a.no_mux:
            return
        enc = mux(video, masterp, outp, a.bitrate)
        dec = decode_audio(outp)
        meter = pyln.Meter(SR)
        l_dec, tp_dec = lufs(meter, dec), true_peak_db(dec)
        vd, ad = probe_dur(outp, "v:0"), probe_dur(outp, "a:0")
        print(f"final  {outp}")
        print(f"       video {vd:.3f} s, audio {ad:.3f} s ({enc} {a.bitrate}); decoded AAC: {l_dec:.2f} LUFS, "
              f"{tp_dec:.2f} dBTP")
        if tp_dec > a.ceiling + 0.2 and attempt == 0:
            ceiling = ceiling - (tp_dec - a.ceiling) - 0.1
            print(f"AAC overshoots the ceiling by {tp_dec - a.ceiling:.2f} dB -> re-mastering at {ceiling:.2f} dBTP")
            continue
        break


if __name__ == "__main__":
    main()
