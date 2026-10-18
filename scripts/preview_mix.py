"""Mix narration + src/audio-manifest.json stems exactly like the Reel will (Remotion: mono VO upmixed
-3 dB/channel by ffmpeg -ac 2, placed at Math.round(start*fps), cut at the Sequence end, amix normalize=0,
stems x volume) -> out/mix_preview.wav, and print numbers to judge the balance without listening:

  * duration check: every stem must be exactly DUR (timeline.json total / fps = 77.000 s, N samples)
  * integrated LUFS, sample peak, 4x-oversampled true peak (mix, VO, bed, each stem)
  * per-scene VO / bed / mix loudness and the VO-over-bed margin while speaking (K-weighted and
    speech band 300 Hz-4 kHz), + the tightest speech-band moments
  * fine RMS zooms of the mix AND of the bed with sync marks (default: the hook 0-8.5 s, the S15
    stumble, S16 -> S17, the rewind, the end; --zoom T0 T1 replaces them)       (--timeline: 0.5 s rows)
  * SYNC check: onset of every event-stream hit (EV.sips drips alarms throbs beats stamps shutdown gulps)
    and of the main hand-placed hits (sfx.F_*) in the sfx stem vs its frame (target: within +-1 frame)
  * event checks (key hits vs the bed before them), exact-zero checks (the dip's black frame, the last
    20 ms), stem peaks (want < -3 dBFS)
  * a picture: out/audio_spec.png (mix spectrogram + loudness curves VO / sfx / music + event ticks)

Memory-lean (float32 buffers, block-wise filters): the build box often has < 1 GB free.
Usage: python scripts/preview_mix.py [--out PATH] [--zoom T0 T1]... [--timeline] [--no-plot]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audiolib import (CHUNK, DUR, EV, FPS, MK, NARR, N, OUT, PUB, SCENES, SR, SRC, TOTAL, _K1, _K2, fsec,  # noqa: E402
                      integrated_lufs, sos, true_peak_db, vo_clip_start_sample, window_loudness)
from scipy.ndimage import uniform_filter1d  # noqa: E402

import sfx as SFX  # noqa: E402  (hand-placed frames F_* live there; importing does not render)

EVENT_KEYS = ("sips", "drips", "alarms", "throbs", "beats", "stamps", "shutdown", "gulps")
W = 0.1  # meter window (s)


def load_vo32() -> np.ndarray:
    vo = np.zeros((N, 2), dtype=np.float32)
    for n in NARR:
        x, sr = sf.read(str(PUB / "audio" / "narr" / f"{n['id']}.wav"), dtype="float32", always_2d=True)
        if sr != SR:
            x = signal.resample_poly(x, SR, sr, axis=0).astype(np.float32)
        x = np.repeat(x[:, :1], 2, axis=1) * np.float32(math.sqrt(0.5)) if x.shape[1] == 1 else x[:, :2]
        x = x[: math.ceil((n["dur"] + 0.2) * FPS) * SR // FPS]
        s = vo_clip_start_sample(n)
        e = min(N, s + len(x))
        vo[s:e] += x[: e - s]
    return vo


def load_stem(path: Path) -> np.ndarray:
    x, sr = sf.read(str(path), dtype="float32", always_2d=True)
    if sr != SR:
        raise SystemExit(f"{path}: {sr} Hz (expected {SR})")
    ok = len(x) == N
    print(f"  {path.name:10s} {len(x)} samples = {len(x) / SR:.4f} s  "
          + ("OK (exactly DUR)" if ok else f"WARNING: expected exactly {DUR:.3f} s ({N} samples, {TOTAL} frames)"))
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1) * np.float32(math.sqrt(0.5))
    x = x[:N, :2]
    if len(x) < N:
        x = np.vstack([x, np.zeros((N - len(x), 2), dtype=np.float32)])
    return x


def chain_power(x, stages, win=W):
    """Per-window power (summed over channels) after a chain of filters [('sos', sos) | ('ba', b, a)],
    block by block with each stage's state carried."""
    w = int(win * SR)
    nw = len(x) // w
    blk = w * max(1, CHUNK // w)
    zs = [np.zeros((st[1].shape[0], 2, 2)) if st[0] == "sos" else np.zeros((2, 2)) for st in stages]
    out = np.empty(nw)
    for c0 in range(0, nw * w, blk):
        c1 = min(nw * w, c0 + blk)
        y = x[c0:c1].astype(np.float64)
        for i, st in enumerate(stages):
            if st[0] == "sos":
                y, zs[i] = signal.sosfilt(st[1], y, axis=0, zi=zs[i])
            else:
                y, zs[i] = signal.lfilter(st[1], st[2], y, axis=0, zi=zs[i])
        out[c0 // w: c1 // w] = np.sum(np.mean(y.reshape(-1, w, 2) ** 2, axis=1), axis=1)
    return out


KW = [("ba", np.array(_K1[0]), np.array(_K1[1])), ("ba", np.array(_K2[0]), np.array(_K2[1]))]
BAND = [("sos", sos("bp", (300, 4000), 2))]
PHONE = [("sos", sos("hp", 280, 2)), ("sos", sos("lp", 9000, 2))] + KW


def p2db(p):
    return 10 * np.log10(np.maximum(p, 1e-20))


def momentary(x, stages):
    return -0.691 + p2db(uniform_filter1d(chain_power(x, stages), 4, mode="nearest"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT / "mix_preview.wav"))
    ap.add_argument("--zoom", nargs=2, type=float, action="append", default=None)
    ap.add_argument("--timeline", action="store_true")
    ap.add_argument("--no-plot", action="store_true")
    a = ap.parse_args()

    assert abs(DUR - TOTAL / FPS) < 1e-9 and N == round(DUR * SR)
    print(f"timeline: {TOTAL} frames @ {FPS} fps = {DUR:.3f} s = {N} samples")
    vo = load_vo32()
    man = json.loads((SRC / "audio-manifest.json").read_text(encoding="utf-8"))
    sfx = np.zeros((N, 2), dtype=np.float32)
    mus = np.zeros((N, 2), dtype=np.float32)
    for m in man:
        x = load_stem(PUB / m["file"]) * np.float32(m["volume"])
        (mus if "music" in m["file"] else sfx)[:] += x
        del x
    bed = sfx + mus
    mix = vo + bed
    out = Path(a.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out), mix, SR, subtype="PCM_24")

    il = integrated_lufs(mix)
    print(f"wrote {out}  ({len(mix) / SR:.3f} s)")
    print(f"stems: {', '.join(m['file'] + ' x' + str(m['volume']) for m in man)}")
    print(f"MIX   integrated {il:6.2f} LUFS | sample peak {20*np.log10(np.max(np.abs(mix))):6.2f} dBFS | "
          f"true peak {true_peak_db(mix):6.2f} dBTP")
    print(f"VO    integrated {integrated_lufs(vo):6.2f} LUFS | BED {integrated_lufs(bed):6.2f} LUFS "
          f"(sfx {integrated_lufs(sfx):6.2f}, music {integrated_lufs(mus):6.2f})")
    print(f"      -> finalize.py will apply about {-14.0 - il:+.1f} dB to reach -14 LUFS")

    lv, lb, lm, ls, lmu = (momentary(x, KW) for x in (vo, bed, mix, sfx, mus))
    sv, sb = momentary(vo, BAND), momentary(bed, BAND)
    pb, pm, pv = momentary(bed, PHONE), momentary(mus, PHONE), momentary(vo, PHONE)
    speak = lv > -32

    def mean_db(v):
        v = v[v > -70]
        return p2db(np.mean(10 ** (v / 10))) if len(v) else -99.0

    print("\nper scene (momentary 0.4 s, LUFS-ish): margin = VO - bed while speaking; speech-band margin = same in"
          " 300 Hz-4 kHz;\nbed(phone) = bed through a 280 Hz high-pass (what a phone speaker keeps)")
    print("  scene    t0     t1    mix    VO    bed   sfx  music  bed(phone) VO-music(phone)  K-margin p10/med   speech-band p10/med")
    km, bm = [], []
    for sid, f0, f1 in SCENES:
        s, e = int(fsec(f0) / W), int(fsec(f1) / W)
        sp = speak[s:e]
        mg = (lv[s:e] - lb[s:e])[sp]
        mb = (sv[s:e] - sb[s:e])[sp]
        km.append(mg)
        bm.append(mb)
        row = (f"  {sid}  {fsec(f0):6.2f} {fsec(f1):6.2f}  {mean_db(lm[s:e]):5.1f} "
               f"{mean_db(lv[s:e][sp]) if sp.any() else -99:5.1f} {mean_db(lb[s:e]):5.1f} {mean_db(ls[s:e]):5.1f} "
               f"{mean_db(lmu[s:e]):5.1f}   {mean_db(pb[s:e]):6.1f}   "
               f"{(mean_db(pv[s:e][sp]) - mean_db(pm[s:e])) if sp.any() else -99:9.1f}       ")
        row += (f"{np.percentile(mg, 10):5.1f} / {np.median(mg):5.1f}      {np.percentile(mb, 10):5.1f} / {np.median(mb):5.1f}"
                if len(mg) else "   -- (no VO)")
        print(row)
    allk, allb = np.concatenate(km), np.concatenate(bm)
    print(f"  ALL speaking: K-margin p10 {np.percentile(allk, 10):.1f} / median {np.median(allk):.1f} dB;  "
          f"speech-band p10 {np.percentile(allb, 10):.1f} / median {np.median(allb):.1f} dB (target >= 10 dB)")
    worst = np.argsort(np.where(speak, sv - sb, np.inf))[:60]
    print("  tightest speech-band margins while speaking (t, frame, margin dB, scene):")
    seen = []
    for i in worst:
        t = i * W
        if any(abs(t - s_) < 0.4 for s_ in seen) or len(seen) >= 14:
            continue
        seen.append(t)
        sid = [s for s, f0, f1 in SCENES if fsec(f0) <= t < fsec(f1)][0]
        print(f"    {t:6.2f}s  f{t * FPS:6.0f}  {sv[i] - sb[i]:5.1f}  {sid}")

    if a.timeline:
        print("\n0.5 s timeline   mix RMS dBFS bar (-60..0)            mixRMS  VO(LU)  bed(LU)  VO-bed")
        rm = window_loudness(mix, 0.5, k=False)
        v5, b5 = window_loudness(vo, 0.5), window_loudness(bed, 0.5)
        for i in range(len(rm)):
            t = i * 0.5
            nbar = int(np.clip((rm[i] + 60) / 60 * 40, 0, 40))
            sid = [s for s, f0, f1 in SCENES if fsec(f0) <= t < fsec(f1)][0]
            d = v5[i] - b5[i]
            flag = "V" if v5[i] > -35 else " "
            print(f"{t:5.1f} {sid} {flag} |{'#' * nbar}{' ' * (40 - nbar)}| {rm[i]:6.1f}  {v5[i]:6.1f}  {b5[i]:6.1f}  "
                  + (f"{d:6.1f}" if v5[i] > -35 else "     -"))

    # ---- marks for the zooms
    marks = {}
    for k, v in MK.items():
        if isinstance(v, list):
            marks.setdefault(fsec(v[0]), k + " start")
            marks.setdefault(fsec(v[1]), k + " end")
        else:
            marks.setdefault(fsec(v), k)
    for key in EVENT_KEYS:
        for f in EV[key]:
            marks[fsec(f)] = f"EV.{key}@{f}"
    for n_ in NARR:
        marks.setdefault(round(n_["start"], 3), f"VO {n_['id']} in")
        marks.setdefault(round(n_["start"] + n_["dur"], 3), f"VO {n_['id']} out")
    for sid, f0, _ in SCENES:
        marks.setdefault(fsec(f0), f"[{sid}]")

    zooms = [(z0, z1, 0.025) for z0, z1 in a.zoom] if a.zoom else [
        (0.0, 8.5, 0.1), (fsec(1600), fsec(1660), 0.05), (fsec(1720), fsec(1800), 0.1), (fsec(1880), fsec(2000), 0.1),
        (fsec(2200), DUR, 0.1)]
    for z0, z1, res in zooms:
        w = int(res * SR)
        print(f"\nzoom {z0:.2f}-{z1:.2f} s, {res*1000:.0f} ms RMS dBFS: bar = BED (sfx+music), then mix, bed")
        for s in range(int(z0 * SR), min(N, int(z1 * SR)), w):
            rmix = 10 * np.log10(np.mean(mix[s:s + w].astype(np.float64) ** 2) + 1e-20)
            rbed = 10 * np.log10(np.mean(bed[s:s + w].astype(np.float64) ** 2) + 1e-20)
            t = s / SR
            tag = ", ".join(v for k, v in sorted(marks.items()) if t <= k < t + w / SR)
            nbar = int(np.clip((rbed + 80) / 70 * 40, 0, 40))
            print(f"  {t:6.3f} f{t*FPS:5.0f} |{'#' * nbar}{' ' * (40 - nbar)}| {rmix:6.1f} {rbed:6.1f}  {tag}")

    def seg(x, t0, t1):
        return x[max(0, int(t0 * SR)):int(t1 * SR)]

    def pk(x):
        return 20 * np.log10(np.max(np.abs(x)) + 1e-20) if len(x) else -400.0

    def rms(x):
        return 10 * np.log10(np.mean(x.astype(np.float64) ** 2) + 1e-20) if len(x) else -400.0

    # ---- SYNC: onset of each hit in the sfx stem = the steepest rise of the (high-passed) 2 ms RMS
    # envelope within +-2 frames of the event, relative to its frame; 1 frame = 33.3 ms.
    def onset(x, t, search=(-0.066, 0.066), hpf=None):
        s0, s1 = int((t + search[0]) * SR), int((t + search[1]) * SR)
        pad = int(0.05 * SR)
        y = x[max(0, s0 - pad): s1].astype(np.float64).mean(axis=1)
        if hpf:
            y = signal.sosfilt(sos("hp", hpf, 2), y)
        y = y[min(pad, s0):]
        w = int(0.002 * SR)
        ed = np.array([10 * np.log10(np.mean(y[i:i + w] ** 2) + 1e-20) for i in range(0, len(y) - w, w)])
        k = int(np.argmax(np.diff(ed))) + 1
        return (s0 + k * w) / SR - t

    def sync(name, frames, **kw):
        if not frames:
            return
        off = np.array([onset(sfx, fsec(f), **kw) * FPS for f in frames])
        bad = [f"{f}({o:+.1f})" for f, o in zip(frames, off) if abs(o) > 1.0]
        print(f"  {name:15s} n={len(frames):2d} onset offset (frames) median {np.median(off):+5.2f}, "
              f"max |{np.max(np.abs(off)):4.2f}|" + (f"  OUT OF +-1: {' '.join(bad[:8])}" if bad else "  ok"))

    print("\nSYNC (sfx stem onsets vs event frames, target +-1 frame):")
    sync("EV.sips", EV["sips"], hpf=150)
    sync("EV.drips", EV["drips"], hpf=1000)
    sync("EV.alarms", EV["alarms"], hpf=300)
    sync("EV.throbs", EV["throbs"], hpf=None)
    sync("EV.beats", EV["beats"], hpf=None)
    sync("EV.stamps", EV["stamps"], hpf=None)
    sync("EV.shutdown", EV["shutdown"], hpf=None)
    sync("EV.gulps", EV["gulps"], hpf=150)
    sync("hand-placed", [SFX.F_GLASS_DOWN, SFX.F_TAP_STOP, SFX.F_CLOCK_START, SFX.F_PINCH_RELEASE, SFX.F_CLINK,
                         SFX.F_DROP17, *SFX.F_TEXT_DRIP, *SFX.F_HOURGLASS, *SFX.F_SPLASH19, *SFX.F_VALVES], hpf=800)
    sync("low hits", [SFX.F_SUB_BOOM, SFX.F_DARK], hpf=None)
    sync("bladder drips", list(SFX.F_BLADDER), hpf=600)
    sync("plump bloops", list(SFX.F_PLUMP), hpf=300)
    clock = []
    for (a0, b0, per, _) in SFX.CLOCK_SEGS:
        f = a0
        while f < b0:
            clock.append(f)
            f += per
    sync("clock ticks", clock[::4], hpf=2000)

    print("\nevent checks (bed = sfx+music; peaks dBFS, bed RMS over the 1 s before; mix incl. VO):")
    T = {"gulp 1": (EV["sips"][0], 0.2), "glass down": (SFX.F_GLASS_DOWN, 0.2), "LAST DROP": (SFX.F_LAST_DROP, 0.2),
         "alarm 2": (EV["alarms"][1], 0.4), "day 1 bell": (EV["stamps"][0], 0.5), "day 3 bell": (EV["stamps"][2], 0.5),
         "shutdown": (EV["shutdown"][0], 0.3), "stumble": (EV["beats"][-4], 0.3), "sub boom": (SFX.F_SUB_BOOM, 0.6),
         "flash": (SFX.F_FLASH, 0.5), "gulp19 1": (EV["gulps"][0], 0.2), "clink": (SFX.F_CLINK, 0.3)}
    for k, (f, d) in T.items():
        tk = fsec(f)
        print(f"  {k:11s} {tk:6.2f}s  bed peak {pk(seg(bed, tk, tk + d)):6.1f}  vs bed RMS before "
              f"{rms(seg(bed, tk - 1.0, tk - 0.03)):6.1f}  | mix peak {pk(seg(mix, tk, tk + d)):6.1f}")

    def mz(x, t0, t1):
        return 100 * np.mean(np.all(seg(x, t0, t1) == 0, axis=1))

    t0s, t1s = fsec(SFX.F_SILENCE[0]), fsec(SFX.F_SILENCE[1])
    print(f"  dip black frame {t0s:.3f}-{t1s:.3f} s: sfx exact-zero {mz(sfx, t0s + 0.001, t1s - 0.001):5.1f} %, "
          f"music exact-zero {mz(mus, t0s + 0.001, t1s - 0.001):5.1f} %")
    print(f"  stems: sfx peak {pk(sfx):6.1f} dBFS (TP {true_peak_db(sfx):6.1f}), music peak {pk(mus):6.1f} dBFS "
          f"(TP {true_peak_db(mus):6.1f})  (want < -3)")
    print(f"  last 20 ms: mix peak {pk(mix[-int(0.02*SR):]):6.1f} dBFS; bed exact-zero over the last 20 ms: "
          f"{mz(bed, DUR - 0.02, DUR):5.1f} %;  last sample bed {np.max(np.abs(bed[-1])):.2e}")

    if not a.no_plot:
        del vo, bed, sfx, mus
        plot(mix, lv, ls, lmu, lb, sv, sb, speak)


def plot(mix, lv, ls, lmu, lb, sv, sb, speak):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    dec = 4
    y = signal.decimate(mix.mean(axis=1).astype(np.float64), dec)
    f, t, S = signal.spectrogram(y, SR / dec, nperseg=2048, noverlap=1536)
    del y
    fig, ax = plt.subplots(3, 1, figsize=(22, 13), sharex=True, gridspec_kw={"height_ratios": [2.2, 1.4, 1.0]})
    ax[0].pcolormesh(t, f, 10 * np.log10(S + 1e-14), shading="auto", vmin=-130, vmax=-40, cmap="magma")
    ax[0].set_yscale("symlog", linthresh=200)
    ax[0].set_ylim(30, SR / dec / 2)
    ax[0].set_ylabel("mix spectrogram (Hz)")
    tt = np.arange(len(lv)) * W
    ax[1].plot(tt, lv, color="#444", lw=0.8, label="VO")
    ax[1].plot(tt, ls, color="#d9480f", lw=0.9, label="sfx")
    ax[1].plot(tt, lmu, color="#1971c2", lw=0.9, label="music")
    ax[1].plot(tt, lb, color="#2b8a3e", lw=0.6, alpha=0.7, label="bed (sfx+music)")
    ax[1].set_ylim(-60, -5)
    ax[1].set_ylabel("momentary LUFS-ish")
    ax[1].legend(loc="upper right", ncol=4, fontsize=8)
    mg = np.where(speak, sv - sb, np.nan)
    ax[2].plot(tt, mg, color="#5f3dc4", lw=0.8)
    ax[2].axhline(10, color="#c92a2a", lw=0.8, ls="--")
    ax[2].set_ylim(-5, 45)
    ax[2].set_ylabel("speech-band VO - bed (dB)")
    ax[2].set_xlabel("seconds")
    for sid, f0, _ in SCENES:
        for a_ in ax:
            a_.axvline(fsec(f0), color="#999", lw=0.4)
        ax[1].text(fsec(f0) + 0.1, -8, sid, fontsize=7, color="#555")
    cols = {"sips": "#1098ad", "drips": "#4dabf7", "alarms": "#fab005", "throbs": "#f76707", "beats": "#e03131",
            "stamps": "#000000", "shutdown": "#868e96", "gulps": "#12b886"}
    for key, c in cols.items():
        for fr in EV[key]:
            ax[1].plot([fsec(fr)] * 2, [-60, -54], color=c, lw=1.0)
    ax[2].set_xlim(0, DUR)
    fig.tight_layout()
    p = OUT / "audio_spec.png"
    fig.savefig(p, dpi=70)
    print(f"\nplot -> {p}")


if __name__ == "__main__":
    main()
