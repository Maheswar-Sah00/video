"""Shared helpers for the procedural audio: timeline/sync data, narration placement exactly as
Remotion mixes it, the VO sidechain (pre-ducking), and small numpy/scipy DSP building blocks.

Used by scripts/sfx.py, scripts/music.py, scripts/preview_mix.py. Everything is synthesised
(no samples) and deterministic (fixed RNG seeds).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import uniform_filter1d

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
PUB = ROOT / "public"
OUT = ROOT / "out"
SR = 48000
CHUNK = 1 << 18  # samples per block for the memory-lean full-length passes

TL = json.loads((SRC / "timeline.json").read_text(encoding="utf-8"))
EV = json.loads((SRC / "sync-events.json").read_text(encoding="utf-8"))
NARR = json.loads((SRC / "narration.json").read_text(encoding="utf-8"))
FPS = TL["fps"]
TOTAL = TL["total"]
DUR = TOTAL / FPS  # from timeline.json (no-water: 77.000 s = 2310 frames)
N = int(round(DUR * SR))  # no-water: 3 696 000 samples
MK = EV["marks"]
AT = {s["id"]: s["at"] for s in TL["scenes"]}
# (id, start frame, end frame) by nominal boundaries
SCENES = [
    (s["id"], s["at"], TL["scenes"][i + 1]["at"] if i + 1 < len(TL["scenes"]) else TOTAL)
    for i, s in enumerate(TL["scenes"])
]

# Per-bus duck depth (dB) while the narration speaks. A bus name may carry a suffix
# ("amb_park", "tick_div"): the prefix before "_" selects the depth.
#   amb   beds (park, inner space, room tones, wind)        body  blood flow / lungs / heartbeat beds
#   fx    discrete events (creaks, squeezes, coughs, CT)    tex   textures (shimmer, fizz, sizzle beds)
#   hit   big / key sync transients (DNA break, stamp, flash)  tick  pops / tinks / splits / kills
#   ui    UI ticks, dings, beeps, chimes                     bird  birdsong
#   heart heartbeats   far  distant things   tr  transition whooshes + scans   voc  breaths
#   hero  the key close-up sounds the picture is ABOUT (gulps, the glass, THE LAST DROP): light duck
#   rw    the S18 tape-rewind garble                                       music the score
# NOTE (no-water reel): the narration runs almost wall-to-wall (21 lines, 0.3-73.6 s, gaps mostly
# 0.3-0.5 s and bridged by the hold), so these depths are effectively a constant offset; they only
# open in the longer gaps (58.3-59.5 s the S16->S17 dip, 63.9-66.4 s the rewind, the end 73.6-77 s).
DUCK_DB = {"amb": 8.0, "bird": 7.0, "fx": 5.0, "tex": 7.0, "body": 6.0, "hit": 3.0, "heart": 5.0, "tick": 4.0,
           "ui": 3.0, "far": 6.0, "tr": 4.0, "voc": 5.0, "hero": 3.0, "rw": 6.0, "music": 7.0}


def bus_duck_db(bus: str) -> float:
    return DUCK_DB[bus.split("_")[0]]


def fsec(frame: float) -> float:
    return frame / FPS


def idx(t: float) -> int:
    return int(round(t * SR))


def db(x: float) -> float:
    return 10 ** (x / 20.0)


def transitions():
    """Boundary transitions: scenes[i].into is the transition from scene i to i+1 at scenes[i+1].at."""
    out = []
    sc = TL["scenes"]
    for i in range(len(sc) - 1):
        tr = sc[i]["into"]
        if tr:
            out.append({"frame": sc[i + 1]["at"], "from": sc[i]["id"], "to": sc[i + 1]["id"], **tr})
    return out


# --------------------------------------------------------------------------------------------
# Narration as Remotion renders it
# --------------------------------------------------------------------------------------------
def vo_clip_start_sample(n: dict) -> int:
    frame = math.floor(n["start"] * FPS + 0.5)  # Math.round(n.start * FPS) in ReelCore
    ms = round(frame / FPS * 1000.0)  # Remotion: adelay=<ms, toFixed(0)>
    return ms * SR // 1000


def load_vo() -> np.ndarray:
    """Stereo narration track exactly as Remotion mixes it.

    Remotion pre-processes every asset with ffmpeg `-ac 2`: a MONO wav is upmixed with the
    equal-power matrix (0.7071 into each channel = -3 dB per channel), then all tracks are summed
    by amix(normalize=0). Clips start at Math.round(start*fps) and are cut at the Sequence end.
    """
    vo = np.zeros((N, 2))
    for n in NARR:
        x, sr = sf.read(str(PUB / "audio" / "narr" / f"{n['id']}.wav"), dtype="float64", always_2d=True)
        if sr != SR:
            x = signal.resample_poly(x, SR, sr, axis=0)
        if x.shape[1] == 1:
            x = np.repeat(x, 2, axis=1) * math.sqrt(0.5)
        else:
            x = x[:, :2]
        seq_frames = math.ceil((n["dur"] + 0.2) * FPS)
        x = x[: seq_frames * SR // FPS]
        s = vo_clip_start_sample(n)
        e = min(N, s + len(x))
        vo[s:e] += x[: e - s]
    return vo


_ACT = None


def load_vo_mono(n_max: int | None = None) -> np.ndarray:
    """Mono (L+R)/2 of load_vo() as float32, built clip by clip (no full stereo float64 buffer).
    n_max: only the first n_max samples."""
    L = N if n_max is None else min(N, n_max)
    m = np.zeros(L, dtype=np.float32)
    for n in NARR:
        s = vo_clip_start_sample(n)
        if s >= L:
            continue
        x, sr = sf.read(str(PUB / "audio" / "narr" / f"{n['id']}.wav"), dtype="float32", always_2d=True)
        if sr != SR:
            x = signal.resample_poly(x, SR, sr, axis=0).astype(np.float32)
        x = x[:, 0] * np.float32(math.sqrt(0.5)) if x.shape[1] == 1 else x[:, :2].mean(axis=1)
        x = x[: math.ceil((n["dur"] + 0.2) * FPS) * SR // FPS]
        e = min(L, s + len(x))
        m[s:e] += x[: e - s]
    return m


def vo_activity(vo: np.ndarray | None = None, thresh_db=-42.0, lookahead=0.14, hold=0.26,
                attack=0.12, release=0.40) -> np.ndarray:
    """0..1 'speaking' envelope at sample rate (float32): 5 ms RMS gate on the narration, short gaps
    bridged (hold), look-ahead so the duck is down when a line starts, asymmetric attack/release
    (10-90 % times), then a final 30 ms smoothing. Cached; call clear_activity() to free it."""
    global _ACT
    if vo is None and _ACT is not None:
        return _ACT
    m = load_vo_mono() if vo is None else (vo.mean(axis=1) if vo.ndim == 2 else vo)
    hop = SR // 200
    nh = N // hop
    p = np.mean(m[: nh * hop].astype(np.float64).reshape(nh, hop) ** 2, axis=1)
    del m
    p = uniform_filter1d(p, 6, mode="nearest")
    act = (10 * np.log10(p + 1e-12) > thresh_db).astype(float)
    la, h = int(round(lookahead * 200)), int(round(hold * 200))
    cs = np.concatenate([[0.0], np.cumsum(act)])
    i = np.arange(nh)
    a2 = ((cs[np.minimum(nh, i + la + 1)] - cs[np.maximum(0, i - h)]) > 0).astype(float)
    ka = 1 - math.exp(-1.0 / (200 * attack / 2.197))
    kr = 1 - math.exp(-1.0 / (200 * release / 2.197))
    env = np.empty(nh)
    y = 0.0
    for k in range(nh):
        t = a2[k]
        y += (t - y) * (ka if t > y else kr)
        env[k] = y
    env = uniform_filter1d(env, 6, mode="nearest")
    out = np.empty(N, dtype=np.float32)
    tk = (np.arange(nh) + 0.5) * hop
    for c0 in range(0, N, CHUNK):
        c1 = min(N, c0 + CHUNK)
        out[c0:c1] = np.interp(np.arange(c0, c1), tk, env)
    _ACT = out
    return out


def clear_activity():
    global _ACT
    _ACT = None


def duck_gain(depth_db: float, act: np.ndarray | None = None) -> np.ndarray:
    a = vo_activity() if act is None else act
    return 10 ** (-depth_db * a / 20.0)


# --------------------------------------------------------------------------------------------
# DSP building blocks
# --------------------------------------------------------------------------------------------
def sos(kind: str, f, order=2):
    if kind == "bp":
        return signal.butter(order, [f[0], min(f[1], 0.45 * SR)], btype="bandpass", fs=SR, output="sos")
    return signal.butter(order, min(f, 0.45 * SR), btype={"lp": "lowpass", "hp": "highpass"}[kind], fs=SR,
                         output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(sos("lp", f, order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(sos("hp", f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos("bp", (lo, hi), order), x, axis=0)


def peq(x, f0, gain_db, q=1.0):
    """RBJ peaking EQ."""
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    al = np.sin(w0) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w0), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w0), 1 - al / A])
    return signal.lfilter(b / a[0], a / a[0], x, axis=0)


def rbj(kind: str, f0: float, q: float):
    f0 = float(np.clip(f0, 10.0, 0.46 * SR))
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    al = sw / (2 * q)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
    else:  # band-pass, 0 dB peak
        b = [al, 0.0, -al]
    a0 = 1 + al
    return [b[0] / a0, b[1] / a0, b[2] / a0, 1.0, -2 * cw / a0, (1 - al) / a0]


def tv_filter(x, fc, kind="bp", q=1.0, block=64):
    """Time-varying biquad cascade. fc: array (len(x)) of cutoff/centre Hz. q: float or list
    (one biquad per entry, e.g. [0.5412, 1.3066] = 4th-order Butterworth low-pass)."""
    qs = q if isinstance(q, (list, tuple)) else [q]
    x2 = x if x.ndim == 2 else x[:, None]
    n, ch = x2.shape
    y = np.empty_like(x2, dtype=np.float64)
    zi = np.zeros((len(qs), 2, ch))
    fc = np.broadcast_to(np.asarray(fc, dtype=np.float64), (n,))
    for s in range(0, n, block):
        e = min(n, s + block)
        f = fc[(s + e) // 2]
        so = np.array([rbj(kind, f, qq) for qq in qs])
        y[s:e], zi = signal.sosfilt(so, x2[s:e], axis=0, zi=zi)
    return y if x.ndim == 2 else y[:, 0]


def white(n, rng, ch=None):
    return rng.standard_normal(n if ch is None else (n, ch))


def pink(n, rng, ch=None):
    from scipy import fft as sfft
    m = sfft.next_fast_len(n, real=True)  # arbitrary n can have huge prime factors (slow FFT)
    w = white(m, rng, ch)
    X = sfft.rfft(w, axis=0)
    f = np.fft.rfftfreq(m, 1 / SR)
    f[0] = f[1]
    s = 1 / np.sqrt(f)
    X *= s[:, None] if w.ndim == 2 else s
    y = sfft.irfft(X, m, axis=0)[:n]
    return y / (np.std(y) + 1e-12)


def brown(n, rng, ch=None, leak=0.9993):
    w = white(n, rng, ch)
    y = signal.lfilter([1.0], [1.0, -leak], w, axis=0)
    y = hp(y, 18)
    return y / (np.std(y) + 1e-12)


def smooth_rand(n, rate, rng, lo=0.0, hi=1.0):
    """Smooth random curve (knots at `rate` Hz, interpolated + box-smoothed)."""
    k = int(n / SR * rate) + 4
    knots = rng.uniform(lo, hi, k)
    tk = (np.arange(k) - 1) * SR / rate
    y = np.interp(np.arange(n), tk, knots)
    w = max(1, int(SR / rate))
    return uniform_filter1d(y, w, mode="nearest")


def keys(points, n=None, t0=0.0):
    """Envelope from (time_s, value) pairs with smoothstep between keys; held outside."""
    n = N if n is None else n
    t = t0 + np.arange(n) / SR
    pts = sorted(points)
    tk = np.array([p[0] for p in pts], dtype=float)
    vk = np.array([p[1] for p in pts], dtype=float)
    if len(tk) == 1:
        return np.full(n, vk[0])
    j = np.clip(np.searchsorted(tk, t, side="right") - 1, 0, len(tk) - 2)
    u = np.clip((t - tk[j]) / np.maximum(tk[j + 1] - tk[j], 1e-9), 0, 1)
    u = u * u * (3 - 2 * u)
    return vk[j] + (vk[j + 1] - vk[j]) * u


def keys_db(points, n=None, t0=0.0, floor=-90.0):
    e = keys(points, n, t0)
    g = 10 ** (e / 20.0)
    g[e <= floor] = 0.0
    return g


def env_ad(n, attack, tau, release=0.01, hold=0.0):
    """Raised-cosine attack, optional hold, exponential decay, cosine tail fade (no clicks)."""
    t = np.arange(n) / SR
    a = np.sin(np.clip(t / max(attack, 1e-6), 0, 1) * np.pi / 2) ** 2
    d = np.exp(-np.maximum(t - attack - hold, 0) / tau)
    e = a * d
    r = int(release * SR)
    if 0 < r < n:
        e[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return e


def bell(n, peak=0.5, p_up=1.0, p_down=1.0):
    """Smooth 0->1->0 envelope over n samples with its maximum at `peak` (0..1).
    p_up/p_down > 1 make that side start/end more gently."""
    u = np.linspace(0, 1, n)
    w = np.where(u < peak, (u / max(peak, 1e-6)) ** p_up, ((1 - u) / max(1 - peak, 1e-6)) ** p_down)
    return np.sin(np.clip(w, 0, 1) * np.pi / 2) ** 2


def fade_edges(x, fin=0.003, fout=0.01):
    x = np.array(x, dtype=np.float64, copy=True)
    a, b = int(fin * SR), int(fout * SR)
    n = len(x)
    if a > 0:
        w = np.sin(np.linspace(0, np.pi / 2, min(a, n))) ** 2
        x[: len(w)] *= w if x.ndim == 1 else w[:, None]
    if b > 0:
        w = np.cos(np.linspace(0, np.pi / 2, min(b, n))) ** 2
        x[n - len(w):] *= w if x.ndim == 1 else w[:, None]
    return x


def osc(freq, n, phase=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    return np.sin(phase + 2 * np.pi * np.cumsum(f) / SR)


def glide(f0, f1, n, tau):
    """Exponential frequency glide f0 -> f1 with time constant tau (s)."""
    t = np.arange(n) / SR
    return f1 + (f0 - f1) * np.exp(-t / tau)


def saw_blep(freq, n, phase0=0.0):
    """Band-limited sawtooth (polyBLEP), freq scalar or per-sample array."""
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m1 = ph < dt
    t1 = ph[m1] / dt[m1]
    y[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = ph > 1 - dt
    t2 = (ph[m2] - 1) / dt[m2]
    y[m2] -= t2 * t2 + t2 + t2 + 1
    return y


def pan_gains(p: float):
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return math.cos(a), math.sin(a)


def sat(x, drive=1.5):
    return np.tanh(x * drive) / drive


def grains(n, rate, rng, length=0.002, rate_env=None):
    """Sparse crackle gate: Poisson impulses with random amplitude smoothed by a short Hann."""
    r = rate / SR if rate_env is None else rate * rate_env / SR
    imp = (rng.random(n) < r) * rng.uniform(0.2, 1.0, n) ** 2
    L = max(3, int(length * SR))
    return signal.fftconvolve(imp, np.hanning(L), mode="same")


def make_ir(rt60, seed, predelay=0.01, damp_hz=5000.0, hi_ratio=0.4, lowcut=120.0, length=None, early=0.0):
    """Stereo decaying-noise impulse response (independent L/R noise = decorrelated tail).
    Highs above damp_hz decay hi_ratio times faster. Unit energy per channel."""
    rng = np.random.default_rng(seed)
    L = int((length or rt60 * 1.15) * SR)
    t = np.arange(L) / SR
    nz = rng.standard_normal((L, 2))
    lo = lp(nz, damp_hz, 2)
    hi_ = nz - lo
    ir = lo * (10 ** (-3 * t / rt60))[:, None] + hi_ * (10 ** (-3 * t / (rt60 * hi_ratio)))[:, None]
    ir = hp(ir, lowcut, 2)
    fi = int(0.006 * SR)
    ir[:fi] *= (np.sin(np.linspace(0, np.pi / 2, fi)) ** 2)[:, None]
    if early > 0:  # a few discrete early reflections
        for k in range(6):
            d = int(rng.uniform(0.004, 0.04) * SR)
            ir[d] += early * rng.uniform(-1, 1, 2) * (0.8 ** k)
    ir = np.vstack([np.zeros((int(predelay * SR), 2)), ir])
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    return ir


def convolve_st(x, ir):
    """Stereo (N,2) x stereo IR, cut to len(x)."""
    out = np.empty((len(x), 2), dtype=np.float32)
    for c in range(2):
        out[:, c] = signal.oaconvolve(x[:, c].astype(np.float64), ir[:, c])[: len(x)]
    return out


def to_stereo(sig, pan=0.0):
    if sig.ndim == 2:
        return sig
    L, R = pan_gains(pan)
    return np.stack([sig * L, sig * R], axis=1)


class Mixer:
    """Named stereo buses (float32, full length) + reverb send buses that return into a bus.

    local=True: a send is convolved right away with just that event (+ its IR tail) and added to the
    return bus -> no full-length send buffers (saves ~35 MB per reverb; the box is short on RAM)."""

    def __init__(self, reverbs: dict, local: bool = False):
        # reverbs: name -> (ir, return_bus)
        self.reverbs = reverbs
        self.local = local
        self.bus: dict[str, np.ndarray] = {}
        self.sends: dict[str, np.ndarray] = {}

    def _buf(self, d, k):
        if k not in d:
            d[k] = np.zeros((N, 2), dtype=np.float32)
        return d[k]

    def add(self, bus, sig, t0, gain_db=0.0, pan=0.0, sends=None, dry=True):
        st = to_stereo(np.asarray(sig, dtype=np.float64), pan) * db(gain_db)
        s = idx(t0)
        a, b = max(0, s), min(N, s + len(st))
        if b <= a:
            return
        seg = st[a - s: b - s]
        if dry:
            self._buf(self.bus, bus)[a:b] += seg
        for rv, sdb in (sends or {}).items():
            if self.local:
                ir, ret = self.reverbs[rv]
                w = np.empty((len(seg) + len(ir) - 1, 2))
                for c in range(2):
                    w[:, c] = signal.oaconvolve(seg[:, c] * db(sdb), ir[:, c])
                e = min(N, a + len(w))
                self._buf(self.bus, ret)[a:e] += w[: e - a]
            else:
                self._buf(self.sends, rv)[a:b] += seg * db(sdb)

    def add_full(self, bus, st, gain=1.0, sends=None):
        """Add a full-length (N,2) layer (gain may be a per-sample array)."""
        g = gain if np.isscalar(gain) else np.asarray(gain)[:, None]
        y = st * g
        self._buf(self.bus, bus)[:] += y
        for rv, sdb in (sends or {}).items():
            if self.local:
                ir, ret = self.reverbs[rv]
                self._buf(self.bus, ret)[:] += convolve_st(y * db(sdb), ir)
            else:
                self._buf(self.sends, rv)[:] += y * db(sdb)

    def render_reverbs(self):
        for rv, buf in self.sends.items():
            ir, ret = self.reverbs[rv]
            self._buf(self.bus, ret)[:] += convolve_st(buf, ir)
        self.sends = {}


class ClipMixer:
    """Memory-lean mixer: every add() stores a float32 clip (start sample, data) per bus instead of
    full-length buses; reverb sends are convolved per clip right away (IR tail included) into a
    return bus. render(prefix) sums the clips of every bus whose group (name before "_") matches.
    Peak RAM ~ one full-length (N,2) buffer + the clips themselves."""

    def __init__(self, reverbs: dict | None = None):
        self.reverbs = reverbs or {}  # name -> (ir, return_bus)
        self.clips: dict[str, list] = {}

    def _put(self, bus, s, st):
        a, b = max(0, s), min(N, s + len(st))
        if b > a:
            self.clips.setdefault(bus, []).append((a, np.asarray(st[a - s: b - s], dtype=np.float32)))

    def add(self, bus, sig, t0, gain_db=0.0, pan=0.0, sends=None, dry=True):
        st = to_stereo(np.asarray(sig, dtype=np.float64), pan) * db(gain_db)
        s = idx(t0)
        if dry:
            self._put(bus, s, st)
        for rv, sdb in (sends or {}).items():
            ir, ret = self.reverbs[rv]
            w = np.empty((len(st) + len(ir) - 1, 2))
            for c in range(2):
                w[:, c] = signal.oaconvolve(st[:, c] * db(sdb), ir[:, c])
            self._put(ret, s, w)

    def groups(self):
        return sorted({b.split("_")[0] for b in self.clips})

    def buses(self):
        return sorted(self.clips)

    def render(self, group=None, bus=None) -> np.ndarray:
        out = np.zeros((N, 2))
        for b, cl in self.clips.items():
            if (bus is not None and b != bus) or (group is not None and b.split("_")[0] != group):
                continue
            for a, x in cl:
                out[a:a + len(x)] += x
        return out


def render_f32(mx: "ClipMixer", group=None, bus=None) -> np.ndarray:
    """ClipMixer.render into a float32 (N,2) buffer (half the RAM of render())."""
    out = np.zeros((N, 2), dtype=np.float32)
    for b, cl in mx.clips.items():
        if (bus is not None and b != bus) or (group is not None and b.split("_")[0] != group):
            continue
        for a, x in cl:
            out[a:a + len(x)] += x
    return out


def filt_inplace(x: np.ndarray, so) -> np.ndarray:
    """sosfilt a full-length (N,2) float32 buffer in place, block by block (filter state carried)."""
    zi = np.zeros((so.shape[0], 2, x.shape[1]))
    for c0 in range(0, len(x), CHUNK):
        c1 = min(len(x), c0 + CHUNK)
        y, zi = signal.sosfilt(so, x[c0:c1].astype(np.float64), axis=0, zi=zi)
        x[c0:c1] = y
    return x


def duck_carve_into(total: np.ndarray, y: np.ndarray, act: np.ndarray, duck_db: float, carve_db: float = 0.0,
                    gain: float = 1.0, lo: float = 300.0, hi: float = 4000.0):
    """total += y ducked by duck_db*act, with the speech band (lo-hi) carved a further carve_db*act.
    Block by block (filter state carried), float32 in/out."""
    so = sos("bp", (lo, hi), 2)
    zi = np.zeros((so.shape[0], 2, y.shape[1]))
    for c0 in range(0, len(y), CHUNK):
        c1 = min(len(y), c0 + CHUNK)
        seg = y[c0:c1].astype(np.float64)
        a = act[c0:c1].astype(np.float64)
        if carve_db:
            midb, zi = signal.sosfilt(so, seg, axis=0, zi=zi)
            seg -= midb * (1 - 10 ** (-carve_db * a / 20))[:, None]
        seg *= (gain * 10 ** (-duck_db * a / 20))[:, None]
        total[c0:c1] += seg


# --------------------------------------------------------------------------------------------
# Gates shared by sfx + music
# --------------------------------------------------------------------------------------------
CUT_FADE = 0.008  # abrupt but click-free (cosine, 8 ms)


def cut_gate(t_cut: float, t_back: float | None = None, fade: float = CUT_FADE, fade_in: float = 0.001) -> np.ndarray:
    """1 before t_cut, cosine fade to exactly 0 over `fade`, exact digital silence until t_back
    (None = forever), then 1 again (fade_in cosine)."""
    g = np.ones(N)
    s, f = idx(t_cut), max(1, int(round(fade * SR)))
    g[s:s + f] = np.cos(np.linspace(0, np.pi / 2, f)) ** 2
    e = N if t_back is None else idx(t_back)
    g[s + f:e] = 0.0
    if t_back is not None:
        k = max(1, idx(fade_in))
        g[e:e + k] *= np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    return g


def tape_stop(x: np.ndarray, t0: float, t1: float, end_rate: float = 0.05, curve: float = 1.8) -> np.ndarray:
    """Varispeed 'tape stop' on a full-length (N,2) buffer: playback rate eases 1 -> end_rate over
    t0..t1 (everything slides DOWN in pitch and slows), amplitude follows the rate, exact zero from t1.
    Before t0 the buffer is untouched."""
    a, b = idx(t0), idx(t1)
    u = np.linspace(0, 1, b - a)
    rate = 1 - (1 - end_rate) * (u ** curve)
    pos = a + np.concatenate([[0.0], np.cumsum(rate)[:-1]])
    y = np.array(x, dtype=np.float64, copy=True)
    grid = np.arange(len(x))
    g = np.sqrt(rate) * np.cos(np.clip((u - 0.85) / 0.15, 0, 1) * np.pi / 2) ** 2
    for c in range(y.shape[1]):
        y[a:b, c] = np.interp(pos, grid, x[:, c]) * g
    y[b:] = 0.0
    return y


def window_gate(t0: float, t1: float, fin: float, fout: float) -> np.ndarray:
    """0 outside [t0-fin, t1+fout] (exact zeros), raised-cosine edges, 1 inside."""
    t = np.arange(N) / SR
    up = np.clip((t - (t0 - fin)) / max(fin, 1e-6), 0, 1)
    dn = np.clip(((t1 + fout) - t) / max(fout, 1e-6), 0, 1)
    return (np.sin(up * np.pi / 2) ** 2) * (np.sin(dn * np.pi / 2) ** 2)


# Picture fades to black at endFadeBlack (no-water: 2274-2310): the sound follows it to exact silence at
# DUR (77.000 s).
T_FADE0 = fsec(MK["endFadeBlack"][0])  # no-water: 75.800 s


def end_fade(t0: float = T_FADE0, t1: float = DUR - 0.02) -> np.ndarray:
    """Global bed shaping: 40 ms fade-in at t=0; smooth fade to exact zero over t0..t1."""
    g = keys([(0.0, 0.0), (0.04, 1.0), (t0, 1.0), (t1, 0.0)])
    g[idx(t1):] = 0.0
    return g


# --------------------------------------------------------------------------------------------
# Measurement + IO
# --------------------------------------------------------------------------------------------
_K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def kweight(x):
    y = signal.lfilter(_K1[0], _K1[1], x, axis=0)
    return signal.lfilter(_K2[0], _K2[1], y, axis=0)


def kw_power(x, win=0.1, k=True):
    """Mean square per channel of the (K-weighted) signal in consecutive `win`-second windows ->
    (n_windows, channels). Block by block with the filter state carried (no full-length copies)."""
    x = x if x.ndim == 2 else x[:, None]
    w = int(round(win * SR))
    nw = len(x) // w
    blk = w * max(1, 240000 // w)
    z1 = np.zeros((2, x.shape[1]))
    z2 = np.zeros((2, x.shape[1]))
    out = np.empty((nw, x.shape[1]))
    for c0 in range(0, nw * w, blk):
        c1 = min(nw * w, c0 + blk)
        y = np.asarray(x[c0:c1], dtype=np.float64)
        if k:
            y, z1 = signal.lfilter(_K1[0], _K1[1], y, axis=0, zi=z1)
            y, z2 = signal.lfilter(_K2[0], _K2[1], y, axis=0, zi=z2)
        out[c0 // w: c1 // w] = np.mean(y.reshape(-1, w, x.shape[1]) ** 2, axis=1)
    return out


def window_loudness(x, win=0.5, k=True):
    """Per-window loudness (LUFS-like if k=True, else RMS dBFS; stereo power summed like BS.1770)."""
    p = kw_power(x, win, k)
    if k:
        return -0.691 + 10 * np.log10(np.sum(p, axis=1) + 1e-20)
    return 10 * np.log10(np.mean(p, axis=1) + 1e-20)


def integrated_lufs(x):
    """BS.1770-4 integrated loudness (400 ms blocks, 75 % overlap, -70 LUFS absolute and -10 LU
    relative gates), from 100 ms K-weighted mean squares (a 400 ms block = 4 consecutive windows;
    identical to the sample-wise definition when the hop is 100 ms). Verified against
    pyloudnorm.Meter.integrated_loudness to < 0.05 LU."""
    z = kw_power(x, 0.1, True)
    if len(z) < 4:
        return -np.inf
    zb = (z[:-3] + z[1:-2] + z[2:-1] + z[3:]) / 4.0
    ps = np.sum(zb, axis=1)
    lk = -0.691 + 10 * np.log10(ps + 1e-30)
    g1 = lk > -70
    if not np.any(g1):
        return -np.inf
    rel = -0.691 + 10 * np.log10(np.mean(ps[g1])) - 10
    g2 = g1 & (lk > rel)
    return float(-0.691 + 10 * np.log10(np.mean(ps[g2])))


def true_peak_db(x, os=4):
    """4x-oversampled true peak (dBTP), block by block with 64-sample overlaps."""
    pk = 0.0
    x = x if x.ndim == 2 else x[:, None]
    for c0 in range(0, len(x), CHUNK):
        a0, c1 = max(0, c0 - 64), min(len(x), c0 + CHUNK + 64)
        y = signal.resample_poly(np.asarray(x[a0:c1], dtype=np.float64), os, 1, axis=0)
        pk = max(pk, float(np.max(np.abs(y))))
    return 20 * np.log10(pk + 1e-20)


def write_wav(path: Path, x: np.ndarray, seed=7):
    """48 kHz stereo 16-bit with TPDF dither (dither skipped on exact digital silence); written block by
    block (no full-length float64 copies)."""
    assert x.shape == (N, 2), x.shape
    pk = float(np.max(np.abs(x)))
    assert pk < 0.99, f"{path.name}: peak {pk:.3f} too hot"
    rng = np.random.default_rng(seed)
    path.parent.mkdir(parents=True, exist_ok=True)
    with sf.SoundFile(str(path), "w", SR, 2, subtype="PCM_16") as f:
        for c0 in range(0, N, CHUNK):
            seg = np.asarray(x[c0:c0 + CHUNK], dtype=np.float64)
            d = (rng.random(seg.shape) - rng.random(seg.shape)) / 32768.0
            d[seg == 0] = 0.0
            f.write(seg + d)


def end_fade_tail(x: np.ndarray, t0: float = None, t1: float = None) -> np.ndarray:
    """In-place end_fade() on a full-length buffer, touching only the start (40 ms) and the tail."""
    t0 = T_FADE0 if t0 is None else t0
    t1 = DUR - 0.02 if t1 is None else t1
    k = idx(0.04)
    x[:k] *= (np.sin(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    a, b = idx(t0), idx(t1)
    u = np.linspace(0, 1, b - a)
    g = 1 - u * u * (3 - 2 * u)
    x[a:b] *= g[:, None]
    x[b:] = 0.0
    return x


def write_manifest():
    files = [f for f in ("audio/sfx.wav", "audio/music.wav") if (PUB / f).exists()]
    man = [{"file": f, "volume": 1} for f in files]
    (SRC / "audio-manifest.json").write_text(json.dumps(man, indent=1) + "\n", encoding="utf-8")
    return man


def section_report(name: str, x: np.ndarray):
    """Short per-scene loudness printout for a stem (computed on 0.1 s mean-square windows)."""
    try:
        lw = window_loudness(np.asarray(x, dtype=np.float32), 0.1)
        il = integrated_lufs(np.asarray(x, dtype=np.float32))
    except MemoryError:
        print(f"  {name}: (report skipped: low memory)")
        return
    print(f"  {name}: peak {20*np.log10(np.max(np.abs(x))+1e-20):6.1f} dBFS, integrated {il:6.1f} LUFS")
    row = []
    for sid, a, b in SCENES:
        seg = lw[int(fsec(a) * 10): int(fsec(b) * 10)]
        seg = seg[seg > -70]
        row.append(f"{sid}:{(10*np.log10(np.mean(10**(seg/10)))) if len(seg) else -99:5.1f}")
    for i in range(0, len(row), 10):
        print("    " + "  ".join(row[i:i + 10]))
