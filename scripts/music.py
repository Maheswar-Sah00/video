"""Score -> public/audio/music.wav (48 kHz stereo, exactly DUR = 77.000 s). All synthesised, deterministic.

One key centre, D: D major for the morning and the resolve, D minor for the decline. From 214 the score's
beat IS the wall clock in sfx.py (CLOCK_SEGS): 30 f (60 bpm) for the hours, then 24 / 20 / 16 f
(75 / 90 / 112.5 bpm) from each DAY stamp (748 980 1423, the bell = the downbeat) -- more urgent each day.
  S01-S02   0-214   curious + light: marimba/celesta quarter-note motif (D lydian colour) over a soft
                    D(add9) pad, 120 bpm; it stops on 'No water', thins to one high held tone for THE LAST
                    DROP (161), a tender Bm -> Gmaj7 on 'ever again', a sus 'question' on 'So how long'.
  hours     214-748 the clock pulse: a soft filtered 8th pulse bass, Dm pads, glassy water arps in S03-S04,
                    a tremolo rub under the thirst alarm, a dark A/Bb rub on 'dark'.
  day 1     748-980 low strings + the pulse at 75 bpm; the pulse steps aside for the headache throbs and the
                    S08 heartbeats (the heartbeat is the rhythm there).
  day 2     980-1423 90 bpm, building: S11 a rising string line into the heat, S12 the pads wobble in pitch
                    (dizzy), S13 the whole score sinks into a closing low-pass (fog).
  day 3     1423-1646 112.5 bpm: the pulse winds down and stops on the kidneys' shutdown (1465); S15 heavy and
                    sparse (low strings, a few low drums, a sub hit on 'crashes'), cut by the dip.
  S16       1646-1765 a sad, tender pad + felt piano, fading to nothing; EXACT ZERO through the dip's black.
  S17       1783-1888 a held silence + ONE low note (D) swelling into 'three days'; hard cut at 1888.
  S18       the rewind is all sfx; a soft riser into the flash 1988.
  S19-S20   1988-2310 warm, bright, upbeat D major at 112.5 bpm (beat 16 f anchored on the first gulp 1996 ->
                    every EV.gulps lands on a beat): plucks, marimba, warm bass, soft kick + shaker; the final
                    D(add9) from 2252 rings out under the picture fade to exact zero at 77.000 s.
Pre-ducked under the narration (audiolib.DUCK_DB['music'] + a speech-band carve). Run: python scripts/music.py
"""
from __future__ import annotations

import math
import sys
import time

import numpy as np

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from audiolib import (DUCK_DB, EV, FPS, MK, N, PUB, SR, ClipMixer, clear_activity, db, duck_carve_into,  # noqa: E402
                      end_fade_tail, env_ad, fade_edges, filt_inplace, fsec, glide, hp, idx, keys, keys_db, lp,
                      make_ir, osc, pan_gains, rbj, render_f32, saw_blep, section_report, smooth_rand, sos,
                      tv_filter, vo_activity, white, write_manifest, write_wav)
from scipy import signal  # noqa: E402

F = fsec
SPEECH_CARVE_DB = 5.0      # extra speech-band duck under the VO (on top of DUCK_DB["music"])
MUSIC_GAIN = 9.0           # global trim (dB)
F_SILENT = (1773, 1783)    # exact zero (the S16 -> S17 dip's black frame), same as sfx.F_SILENCE
F_CUT = 1888               # hard cut into the rewind
GRID_M = (0, 15)           # S01-S02 morning: 120 bpm
CLOCK = [(214, 734, 30), (748, 980, 24), (980, 1423, 20), (1423, 1646, 16)]  # = sfx.CLOCK_SEGS anchors/periods
GRID_R = (EV["gulps"][0], 16)  # S19-S20: 112.5 bpm, beat on every gulp


def mid(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-12)


def voice(f, n, rng, partials, detune_c=4.0, wow=0.0008):
    t = np.arange(n) / SR
    y = np.zeros(n)
    for c in (-detune_c, detune_c):
        drift = 1 + wow * np.sin(2 * np.pi * 0.23 * t + rng.random() * 6) + \
            0.5 * wow * np.sin(2 * np.pi * 0.71 * t + rng.random() * 6)
        ph = 2 * np.pi * np.cumsum(f * 2 ** (c / 1200) * drift) / SR
        for k, a in partials:
            y += a * np.sin(k * ph + rng.random() * 6.283)
    return y


SOFT = ((1, 1.0), (2, 0.32), (3, 0.12), (4, 0.05))
WARM = ((1, 1.0), (2, 0.5), (3, 0.3), (4, 0.18), (5, 0.1), (6, 0.06))
STR = ((1, 1.0), (2, 0.55), (3, 0.38), (4, 0.25), (5, 0.17), (6, 0.11), (7, 0.07))


def pad(notes, t0, t1, level_db, attack, release, cutoff, seed, partials=SOFT, lev_env=None, air=0.0,
        spread=0.8, wow=0.0008, detune=4.0, bend=None, trem=None, vib=0.0):
    """Chord pad t0..t1 (+release), normalised to `level_db` RMS (sustain) before the envelope.
    bend: [(abs time, semitones)]. trem: (rate Hz, depth). vib: vibrato depth (fraction, 5.2 Hz)."""
    rng = np.random.default_rng(seed)
    n = idx(t1 - t0 + release)
    t = np.arange(n) / SR
    bm = 2 ** (keys([(a - t0, v) for a, v in bend], n) / 12) if bend else np.ones(n)
    if vib:
        bm = bm * (1 + vib * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.8, 0, 1))
    st = np.zeros((n, 2))
    for k, m in enumerate(notes):
        v = voice(mid(m) * bm, n, rng, partials, detune, wow) * (1 + 0.12 * smooth_rand(n, 0.25, rng, -1, 1))
        if trem:
            v *= 1 - trem[1] * (0.5 + 0.5 * np.sin(2 * np.pi * trem[0] * (1 + 0.05 * k) * t + rng.random() * 6))
        if air and m >= 60:
            c = rbj("bp", mid(m) * 2, 30.0)
            v += air * signal.lfilter(c[:3], c[3:], white(n, rng)) * 6 * smooth_rand(n, 0.5, rng, 0.3, 1.0)
        p = (-0.5 + k / max(1, len(notes) - 1)) * spread if len(notes) > 1 else 0.0
        L, R = pan_gains(p)
        st[:, 0] += v * L
        st[:, 1] += v * R
    st = lp(lp(st, cutoff, 2), cutoff * 1.6, 1)
    sus = st[idx(min(attack, (t1 - t0) / 2)): idx(t1 - t0)]
    st /= np.sqrt(np.mean(sus ** 2)) + 1e-12
    env = np.sin(np.clip(t / attack, 0, 1) * np.pi / 2) ** 2
    env *= np.cos(np.clip((t - (t1 - t0)) / release, 0, 1) * np.pi / 2) ** 2
    if lev_env is not None:
        env *= 10 ** (keys([(a - t0, v) for a, v in lev_env], n) / 20)
    return st * (env * db(level_db))[:, None]


def mallet(m, vel, rng, dur=1.4, kind="celesta"):
    """celesta: bright bell-ish pluck; marimba: woody (1, 3.93, 9.2); bell: long glassy bell."""
    f = mid(m)
    n = idx(dur)
    t = np.arange(n) / SR
    if kind == "marimba":
        parts = [(1.0, 1.0, 0.45), (3.93, 0.3, 0.07), (9.2, 0.08, 0.02)]
        att = 0.0025
    elif kind == "bell":
        parts = [(1.0, 1.0, 1.6), (2.0, 0.1, 0.6), (3.0, 0.08, 0.25), (4.07, 0.04, 0.12)]
        att = 0.004
    else:
        parts = [(1.0, 1.0, 0.8), (2.0, 0.28, 0.3), (3.0, 0.08, 0.12), (4.0, 0.04, 0.07)]
        att = 0.0015
    y = np.zeros(n)
    for r, a, tau in parts:
        if f * r < 14000:
            y += a * np.exp(-t / tau) * np.sin(2 * np.pi * f * r * t + rng.random() * 6.283)
    y *= np.sin(np.clip(t / att, 0, 1) * np.pi / 2) ** 2
    if kind != "bell":
        y += 0.08 * norm(hp(white(n, rng), 2500, 2)) * np.exp(-t / 0.002)
    return fade_edges(y, 0.0, min(0.3, dur / 3)) * vel


def piano(m, vel, rng, dur=3.0, felt=2600.0):
    """Felt piano: slightly inharmonic partials, two-stage decay, a soft hammer, warm low-pass."""
    f = mid(m)
    n = idx(dur)
    t = np.arange(n) / SR
    B = 0.0004
    y = np.zeros(n)
    for k in range(1, 11):
        fk = k * f * math.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        a = (1.0 / k ** 1.25) * (0.6 + 0.4 * vel)
        tau1, tau2 = 0.35 / k ** 0.5, 2.6 / k ** 0.7 * (440 / f) ** 0.25
        e = 0.55 * np.exp(-t / tau1) + 0.45 * np.exp(-t / tau2)
        y += a * e * np.sin(2 * np.pi * fk * t + rng.random() * 6.283)
    y *= np.sin(np.clip(t / 0.003, 0, 1) * np.pi / 2) ** 2
    y += 0.05 * norm(lp(white(n, rng), 1200, 2)) * np.exp(-t / 0.006)
    y = lp(y, felt * (0.6 + 0.4 * vel), 2)
    return fade_edges(y, 0.0, min(0.4, dur / 3)) * vel


def pluck_synth(m, vel, rng, d=0.2, cutoff=1500.0, env_amt=4.0):
    """Arp pluck: two detuned saws through a low-pass whose cutoff snaps down (filter envelope)."""
    n = idx(d + 0.15)
    t = np.arange(n) / SR
    f = mid(m)
    y = saw_blep(f * 1.003, n) + saw_blep(f * 0.997, n, 0.41)
    fc = cutoff * (1 + env_amt * np.exp(-t / 0.05))
    y = tv_filter(y, fc, "lp", [0.5412, 1.3066], block=64)
    e = np.sin(np.clip(t / 0.003, 0, 1) * np.pi / 2) ** 2 * np.exp(-t / (d * 0.7))
    e *= np.cos(np.clip((t - d) / 0.15, 0, 1) * np.pi / 2) ** 2
    return y * e * vel


def pulse_bass(m, d, rng, cutoff=400.0, vel=1.0):
    """Tension pulse: saw + sub sine, filter envelope, short and tight."""
    n = idx(d + 0.08)
    t = np.arange(n) / SR
    f = mid(m)
    y = saw_blep(f, n) + 0.8 * np.sin(2 * np.pi * f * t)
    fc = cutoff * (1 + 2.0 * np.exp(-t / 0.04))
    y = tv_filter(y, fc, "lp", [0.5412, 1.3066], block=64)
    e = np.sin(np.clip(t / 0.004, 0, 1) * np.pi / 2) ** 2 * (0.55 + 0.45 * np.exp(-t / 0.07))
    e *= np.cos(np.clip((t - d) / 0.08, 0, 1) * np.pi / 2) ** 2
    return y * e * vel


def warm_bass(m, d, rng, vel=1.0):
    """Round plucked bass for the resolve: sine + soft 2nd/3rd, quick decay."""
    n = idx(d + 0.1)
    t = np.arange(n) / SR
    f = mid(m)
    y = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t + 0.3) + 0.12 * np.sin(6 * np.pi * f * t + 0.7)
    e = np.sin(np.clip(t / 0.005, 0, 1) * np.pi / 2) ** 2 * (0.4 + 0.6 * np.exp(-t / 0.18))
    e *= np.cos(np.clip((t - d) / 0.1, 0, 1) * np.pi / 2) ** 2
    return lp(y * e, 900, 2) * vel


def drum(rng, f0=60.0, vel=1.0, d=1.2, skin_amt=0.5):
    n = idx(d)
    t = np.arange(n) / SR
    body = osc(glide(f0 * 1.6, f0, n, 0.025), n) * np.exp(-t / 0.28)
    skin = lp(white(n, rng), 900, 2) * np.exp(-t / 0.05) * skin_amt
    clk = 0.12 * lp(white(n, rng), 2500, 2) * np.exp(-t / 0.004)
    y = np.tanh(1.5 * (body + skin + clk)) * np.sin(np.clip(t / 0.002, 0, 1) * np.pi / 2) ** 2
    return fade_edges(y, 0.0, 0.2) * vel


def shaker(rng, vel=1.0):
    n = idx(0.09)
    t = np.arange(n) / SR
    y = hp(white(n, rng), 5000, 2) * np.sin(np.clip(t / 0.012, 0, 1) * np.pi / 2) ** 2 * np.exp(-t / 0.025)
    return fade_edges(norm(y), 0.0, 0.01) * vel


def sub_hit(rng, f0=55.0, d=3.5, tau=1.0):
    """Deep cinematic hit: sub drop + a low thump + a dark noise bloom."""
    n = idx(d)
    y = osc(glide(f0 * 1.5, f0 * 0.7, n, 0.25), n) * env_ad(n, 0.006, tau, 0.3)
    y += 0.5 * osc(glide(f0 * 3, f0 * 1.4, n, 0.05), n) * env_ad(n, 0.003, 0.12)
    y += 0.25 * lp(white(n, rng), 300, 2) * env_ad(n, 0.004, 0.3)
    return fade_edges(np.tanh(1.4 * y), 0.0, 0.3)


def riser(rng, d, lo=400, hi=4000, tone=None):
    n = idx(d)
    t = np.arange(n) / SR
    fc = np.exp(np.linspace(math.log(lo), math.log(hi), n))
    y = tv_filter(white(n, rng, 2), fc, "bp", 1.0, block=64) * ((t / d) ** 2.2)[:, None]
    if tone:
        to = osc(np.exp(np.linspace(math.log(tone), math.log(tone * 2), n)), n) * (t / d) ** 2
        y += 0.3 * np.stack([to, to], 1)
    return fade_edges(y / np.max(np.abs(y)), 0.01, 0.006)


def st(y):
    return np.stack([y, y], 1) if y.ndim == 1 else y


def grid(g, f0, f1, step=1.0):
    """Frames of a beat grid (anchor, beat frames) between f0 and f1, subdivided by `step` beats."""
    a, p = g
    q = p * step
    k0 = math.ceil((f0 - a) / q - 1e-9)
    out = []
    k = k0
    while a + k * q < f1 - 1e-9:
        out.append(a + k * q)
        k += 1
    return out


def chord_at(table, f):
    return [c for (fr, c) in table if fr <= f + 0.5][-1]


# =============================================================================================
def build_morning(mx, rng):
    """S01-S02: curious and light, then the stop on 'No water', the held tone for the last drop, a tender
    'ever again', a question on 'So how long would you last?'."""
    mx.add("pad", pad([50, 57, 64, 66, 69], F(0), F(150), -52, 0.8, 0.8, 2600, seed=1, partials=WARM, air=0.05,
                      spread=1.0, lev_env=[(F(0), -5), (F(20), 0), (F(92), 0), (F(100), -4), (F(140), -6), (F(150), -12)]),
           F(0), sends={"hall": -8})
    # the motif (quarter notes, 120 bpm; D lydian: the G# is the curious colour), stops on 'No water'
    seq = [74, 69, 78, 76, 74, 81, 80, 78, 76, 74, 73, 69, 71, 74, 76, 78, 80, 81]
    for k, f in enumerate(grid(GRID_M, 6, 93, 0.5)):
        if k % 2 and k not in (5, 9, 13):
            continue
        m = seq[k % len(seq)]
        acc = 1.0 if k % 4 == 0 else 0.75
        mx.add("keys", mallet(m, 0.5 * acc, rng, 0.9, "marimba"), F(f), -28, 0.25 * math.sin(k * 1.3), {"hall": -10})
        if k % 4 == 0:
            mx.add("keys", mallet(m + 12, 0.25, rng, 1.2, "celesta"), F(f), -33, -0.2, {"hall": -8})
    for f, m in [(6, 38), (36, 45), (66, 43)]:
        mx.add("keys", mallet(m + 12, 0.75, rng, 1.6, "marimba"), F(f), -27, 0.0, {"hall": -12})
    # 'No water' / 'No juice': two soft low 'stop' notes, the pad thinning
    for f, m in [(96, 38), (122, 37)]:
        mx.add("keys", st(piano(m + 12, 0.5, rng, 2.5, 1400)), F(f), -30, 0.0, {"hall": -6})
    # 'Not a single drop': one high held tone (glassy), swelling into the drop and holding still
    mx.add("str", pad([81, 88], F(140), F(182), -60, 0.5, 0.6, 5000, seed=2, partials=SOFT, spread=0.5, vib=0.002,
                      lev_env=[(F(140), -6), (F(158), 0), (F(182), -3)]), F(140), sends={"hall": -3})
    # 'ever again': tender Bm(add9) -> Gmaj7
    mx.add("pad", pad([47, 54, 59, 62, 66, 73], F(172), F(196), -53, 0.5, 0.3, 2000, seed=3, partials=WARM, spread=0.9),
           F(172), sends={"hall": -6})
    mx.add("pad", pad([43, 50, 59, 62, 66], F(193), F(208), -54, 0.15, 0.3, 1900, seed=4, partials=WARM, spread=0.9),
           F(193), sends={"hall": -6})
    for f, m, v in [(176, 66, 0.4), (184, 62, 0.35), (194, 59, 0.33)]:
        mx.add("keys", st(piano(m, v, rng, 2.8, 2200)), F(f), -33, 0.1, {"hall": -5})
    # 'So how long would you last?': A sus4 question, low, hanging into the clock
    mx.add("pad", pad([45, 52, 57, 62, 64], F(205), F(232), -53, 0.25, 0.6, 1600, seed=5, partials=SOFT, spread=0.8),
           F(205), sends={"hall": -6})


# chord tables (frame, notes) for the decline -- D minor
HOURS = [(214, [38, 50, 53, 57, 64]), (286, [34, 46, 53, 58, 62]), (344, [31, 43, 50, 55, 58]),
         (367, [38, 50, 53, 57, 62]), (430, [33, 45, 52, 57, 61]), (490, [38, 50, 53, 57, 64]),
         (571, [34, 46, 50, 53, 58]), (591, [31, 43, 50, 55, 58, 61]), (634, [41, 50, 53, 57, 60]),
         (705, [34, 46, 53, 57, 62]), (719, [33, 46, 52, 57, 58])]
DAY1 = [(748, [38, 50, 53, 57, 62]), (810, [31, 43, 50, 55, 58]), (844, [39, 50, 55, 58, 62]),
        (878, [34, 46, 53, 58, 62]), (923, [31, 43, 50, 55, 58, 62]), (946, [33, 45, 52, 57, 61, 64])]
DAY2 = [(980, [38, 50, 53, 57, 62, 65]), (1048, [34, 46, 53, 58, 62]), (1096, [31, 43, 50, 55, 58, 62]),
        (1154, [39, 51, 55, 58, 63]), (1180, [33, 45, 52, 57, 61, 64]), (1259, [38, 50, 53, 57, 62, 65]),
        (1326, [34, 46, 53, 58, 62, 65]), (1375, [33, 45, 52, 55, 58, 61, 64])]
DAY3 = [(1423, [38, 50, 53, 57, 62, 65]), (1465, [38, 49, 53, 56, 62]), (1535, [37, 49, 52, 57, 62]),
        (1580, [38, 50, 51, 57, 62])]


def pads_from(mx, table, f_end, lv, seed0, cut0, cut1, partials=WARM, trem_from=None, lv_env=None, bend_win=None):
    for i, (a, notes) in enumerate(table):
        b = table[i + 1][0] if i + 1 < len(table) else f_end
        u = i / max(1, len(table) - 1)
        tr = (9.0 + 3 * u, 0.3) if trem_from is not None and a >= trem_from else None
        bend = None
        if bend_win and a <= bend_win[0] < b:  # dizzy: a slow pitch wobble inside this pad
            w0, w1 = bend_win
            pts = [(F(a), 0.0), (F(w0), 0.0)]
            k = 0
            tt = F(w0)
            while tt < F(w1):
                tt += 0.45
                k += 1
                pts.append((tt, 0.35 * (-1) ** k))
            pts.append((F(w1) + 0.3, 0.0))
            bend = pts
        mx.add("pad", pad(notes, F(a) - 0.03, F(b) + 0.03, lv + (lv_env(a) if lv_env else 0), 0.35 if i else 0.15, 0.25,
                          cut0 + (cut1 - cut0) * u, seed=seed0 + i, partials=partials, spread=0.9, trem=tr, bend=bend),
               F(a) - 0.03, sends={"hall": -9})


def build_hours(mx, rng):
    pads_from(mx, HOURS, 748, -48.5, 100, 1300, 1900, trem_from=591)
    # the clock pulse: soft filtered 8ths (beat 30 f), roots from the chords, an octave layer for phones
    a, per = 214, 30
    for k, f in enumerate(grid((a, per), 214, 736, 0.5)):
        root = chord_at(HOURS, f)[0]
        u = (f - 214) / (736 - 214)
        acc = 1.0 if k % 2 == 0 else 0.6
        lv = -33.5 + 4 * min(1.0, u * 1.6)
        mx.add("pulse", st(pulse_bass(root, 0.18, rng, 260 + 380 * u, acc)), F(f), lv)
        mx.add("pulse", st(pulse_bass(root + 12, 0.12, rng, 500 + 600 * u, acc * 0.7)), F(f), lv - 9, 0.2 * (1 if k % 2 else -1))
    # S03-S04: glassy water arps (celesta 8ths, quiet), rising with the water and leaking away
    arp = [62, 65, 69, 76, 74, 69, 65, 69]
    for k, f in enumerate(grid((214, 30), 262, 486, 0.5)):
        ch = chord_at(HOURS, f)
        tones = sorted(set(m for m in ch if m >= 50))
        m = tones[[0, 1, 2, 3, 2, 1, 3, 2][k % 8] % len(tones)] + 12
        vel = 0.28 if k % 2 else 0.38
        mx.add("keys", mallet(m, vel, rng, 1.0, "celesta"), F(f), -33, 0.35 * math.sin(k * 0.9), {"hall": -6})
    # the alarm: a tremolo string rub (591-634), the ADH falling: a soft descending line
    mx.add("str", pad([74, 75], F(588), F(636), -60, 0.3, 0.3, 3200, seed=150, partials=STR, spread=0.7, trem=(8.0, 0.6)),
           F(588), sends={"hall": -8})
    # 'dark': a low A + Bb rub (cello-ish), into day 1
    mx.add("str", pad([33, 34, 45], F(717), F(748), -54, 0.15, 0.1, 900, seed=151, partials=STR, spread=0.4,
                      lev_env=[(F(717), 0), (F(746), 2)]), F(717), sends={"hall": -8})
    mx.add("hit", riser(rng, F(748 - 722), 300, 3500, tone=None), F(722), -40, 0.0)


def build_day1(mx, rng):
    mx.add("hit", st(sub_hit(rng, 49, 3.0, 0.9)), F(748), -27, 0.0, {"big": -6})
    pads_from(mx, DAY1, 980, -50, 200, 1400, 2000, partials=STR)
    # the pulse at 75 bpm (8ths = 12 f); out for the headache throbs and under the S08 heartbeats
    for k, f in enumerate(grid((748, 24), 748, 978, 0.5)):
        if 805 <= f < 852 or f >= 868:
            continue
        root = chord_at(DAY1, f)[0]
        acc = 1.0 if k % 2 == 0 else 0.62
        mx.add("pulse", st(pulse_bass(root, 0.16, rng, 520, acc)), F(f), -31)
        mx.add("pulse", st(pulse_bass(root + 12, 0.1, rng, 900, acc * 0.7)), F(f), -40, 0.2 * (1 if k % 2 else -1))
    # 'can't think straight': the pads blur (a detuned, wobbling high cluster)
    mx.add("str", pad([69, 70], F(844), F(878), -60, 0.4, 0.3, 3000, seed=210, partials=STR, spread=0.8, trem=(5.5, 0.5),
                      bend=[(F(844), 0), (F(856), 0.3), (F(866), -0.3), (F(878), 0)]), F(844), sends={"hall": -6})
    # S08: a low string pedal + soft low drum on the heart's strongest beats (sparse)
    mx.add("str", pad([45, 57], F(878), F(980), -56, 1.2, 0.2, 1400, seed=211, partials=STR, spread=0.5, vib=0.003,
                      lev_env=[(F(878), -6), (F(975), 1)]), F(878), sends={"hall": -8})
    mx.add("hit", riser(rng, F(980 - 950), 300, 4000, tone=220), F(950), -40, 0.0)


def build_day2(mx, rng):
    mx.add("hit", st(sub_hit(rng, 46, 3.0, 0.9)), F(980), -26, 0.0, {"big": -6})
    pads_from(mx, DAY2, 1423, -49, 300, 1500, 2400, partials=STR, trem_from=1180, bend_win=(1288, 1326))
    fog_cut = None
    for k, f in enumerate(grid((980, 20), 980, 1420, 0.5)):
        root = chord_at(DAY2, f)[0]
        u = (f - 980) / 440
        acc = 1.0 if k % 2 == 0 else 0.62
        up = 12 if (k % 8 == 7) else 0
        mx.add("pulse", st(pulse_bass(root + up, 0.14, rng, 560 + 500 * u, acc)), F(f), -31 + 2 * u)
        mx.add("pulse", st(pulse_bass(root + 12 + up, 0.09, rng, 1000 + 600 * u, acc * 0.7)), F(f), -40 + 2 * u,
               0.2 * (1 if k % 2 else -1))
    # low drums on the beat from S11 (heat), every beat from S12
    for k, f in enumerate(grid((980, 20), 1180, 1420, 1.0)):
        if f < 1259 and k % 2:
            continue
        mx.add("drum", st(drum(rng, 52 if k % 4 == 0 else 60, 0.7, 0.9)), F(f), -31 + (2 if f >= 1259 else 0))
    # S11: a rising string line into the heat
    mx.add("str", pad([69, 76], F(1180), F(1262), -59, 1.0, 0.2, 3400, seed=320, partials=STR, spread=0.6, vib=0.004,
                      bend=[(F(1180), 0), (F(1259), 2.0)], lev_env=[(F(1180), -8), (F(1255), 1)]), F(1180), sends={"hall": -6})
    mx.add("hit", riser(rng, F(1423 - 1395), 300, 4500, tone=220), F(1395), -39, 0.0)


def build_day3(mx, rng):
    s = EV["shutdown"][0]
    mx.add("hit", st(sub_hit(rng, 43, 3.2, 1.0)), F(1423), -25, 0.0, {"big": -6})
    pads_from(mx, DAY3, 1646, -49, 400, 1500, 1100, partials=STR)
    # the pulse at 112.5 bpm (8ths = 8 f) ... winding down and stopping on the shutdown
    f = 1423.0
    k = 0
    while f < s:
        root = 38
        wind = max(0.0, (f - (s - 18)) / 18)  # last 18 frames: slower, falling, darker
        mx.add("pulse", st(pulse_bass(root - 5 * wind, 0.12 + 0.1 * wind, rng, 800 - 500 * wind, 1.0 if k % 2 == 0 else 0.6)),
               F(f), -30 - 4 * wind)
        mx.add("pulse", st(pulse_bass(root + 12 - 5 * wind, 0.08, rng, 1300 - 800 * wind, 0.6)), F(f), -39 - 6 * wind)
        f += 8 * (1 + 1.6 * wind)
        k += 1
    # after it: a low drone + sparse low drums (16 f grid, every 2nd beat), heavier in S15
    for k, f in enumerate(grid((1423, 16), s + 16, 1640, 2.0)):
        heavy = f >= 1535
        if heavy and k % 2:
            continue
        mx.add("drum", st(drum(rng, 44, 0.65 if not heavy else 0.85, 1.2, 0.6)), F(f), -31 + (2 if heavy else 0))
    mx.add("hit", st(sub_hit(rng, 41, 3.5, 1.1)), F(MK["crashes"]), -27, 0.0, {"big": -6})
    # S15 heavy low strings, the stumble = a dissonant hold that the dip takes away
    mx.add("str", pad([38, 39, 50], F(1535), F(1646), -54, 1.0, 0.3, 900, seed=450, partials=STR, spread=0.5, vib=0.003,
                      lev_env=[(F(1535), -6), (F(1600), 0), (F(1625), 1), (F(1646), -10)]), F(1535), sends={"hall": -8})


def build_fade(mx, rng):
    """S16: sad, tender, fading to nothing before the dip's black frame."""
    P = [(1640, 1688, [38, 50, 57, 62, 64], -54), (1686, 1722, [34, 46, 53, 57, 62], -55),
         (1720, 1752, [31, 43, 50, 55, 58, 64], -56), (1750, 1768, [33, 45, 52, 57, 62], -58)]
    for i, (a, b, notes, lv) in enumerate(P):
        last = i == len(P) - 1
        mx.add("pad", pad(notes, F(a), F(b), lv, 1.2 if i == 0 else 0.5, 0.15 if last else 0.5, 1500, seed=500 + i,
                          partials=STR, spread=0.9, vib=0.002, lev_env=[(F(a), 0), (F(b), -10)] if last else None),
               F(a), sends={"hall": -5})
    for f, m, v in [(1650, 74, 0.36), (1668, 69, 0.32), (1690, 65, 0.32), (1706, 64, 0.3), (1722, 62, 0.28),
                    (1742, 57, 0.22)]:
        mx.add("keys", st(piano(m, v, rng, 3.0, 2000)), F(f), -29, 0.1, {"hall": -4})


def build_lifetime(mx, rng):
    """S17: a held silence + ONE low note (D) swelling into 'three days'."""
    mx.add("str", pad([26, 38, 50], F(1794), F(1888), -50, 2.0, 0.02, 700, seed=600, partials=STR, spread=0.3, vib=0.002,
                      lev_env=[(F(1794), -12), (F(1844), -4), (F(1852), 0), (F(1888), -1)]), F(1794), sends={"hall": -7})
    mx.add("str", pad([86], F(1852), F(1888), -64, 0.6, 0.02, 6000, seed=601, partials=SOFT, spread=0.0, vib=0.003),
           F(1852), sends={"hall": -3})
    mx.add("hit", riser(rng, F(1988 - 1958), 400, 6000, tone=None), F(1958), -40, 0.0)


RES = [(1988, [38, 50, 57, 62, 66, 69]), (2028, [37, 49, 57, 61, 64, 69]), (2060, [35, 47, 54, 59, 62, 66]),
       (2092, [31, 43, 55, 59, 62, 66]), (2124, [30, 42, 54, 57, 62, 66]), (2156, [31, 43, 55, 59, 62, 67]),
       (2188, [33, 45, 55, 57, 62, 64]), (2220, [33, 45, 57, 61, 64, 69]), (2252, [38, 50, 57, 62, 64, 66, 69, 74])]


def build_resolve(mx, rng):
    """S19-S20: warm, bright, upbeat D major; beat 16 f anchored on the first gulp."""
    for i, (a, notes) in enumerate(RES):
        b = RES[i + 1][0] if i + 1 < len(RES) else 2310
        last = b == 2310
        lv = -52 + 4 * min(1.0, (a - 1988) / 200)
        mx.add("pad", pad(notes, F(a) - 0.04, F(b) - (0.02 if last else -0.04), lv, 0.06 if i == 0 else 0.3,
                          0.02 if last else 0.3, 2600 + 5 * (a - 1988), seed=700 + i, partials=WARM, air=0.05, spread=1.0),
               F(a) - 0.04, sends={"hall": -6})
    # the flash bloom: celesta sparkle up
    for j, m in enumerate((74, 78, 81, 86, 90)):
        mx.add("keys", mallet(m, 0.45 - 0.05 * j, rng, 2.0, "celesta"), F(1988) + 0.05 * j, -32, -0.4 + 0.2 * j, {"hall": -4})
    # the groove from the first gulp: plucks 8ths, marimba on the off-beats, bass on the beats, kick 1 + 3,
    # shaker 8ths; stops at the final chord 2252
    for k, f in enumerate(grid(GRID_R, 1996, 2252, 0.5)):
        ch = chord_at(RES, f)
        tones = sorted(set(m for m in ch if m >= 54))
        pat = [0, 2, 1, 3, 2, 1, 3, 4]
        m = tones[pat[k % 8] % len(tones)] + 12
        vel = 0.5 if k % 2 == 0 else 0.36
        mx.add("arp", st(pluck_synth(m, vel, rng, 0.12, 1700, 3.0)), F(f), -39, 0.35 * math.sin(k * 0.8), {"hall": -10})
        if k % 2 == 1 and k % 4 != 3:
            mx.add("keys", mallet(tones[(k // 2) % len(tones)], 0.4, rng, 0.8, "marimba"), F(f), -31, -0.25, {"hall": -10})
        mx.add("tick", st(shaker(rng, 1.0 if k % 2 else 0.55)), F(f), -46, 0.3)
    for k, f in enumerate(grid(GRID_R, 1996, 2252, 1.0)):
        root = chord_at(RES, f)[0]
        mx.add("bass", st(warm_bass(root + 12, 0.32, rng, 1.0 if k % 2 == 0 else 0.8)), F(f), -29)
        if k % 2 == 0:
            mx.add("drum", st(drum(rng, 55, 0.6, 0.7, 0.3)), F(f), -35)
    # S20 'Go drink a glass of water': a celesta lift; the final chord blooms at 2252 under the fade
    for f, m, v, p in [(2170, 81, 0.4, 0.2), (2173, 86, 0.35, -0.2), (2181, 90, 0.35, 0.25), (2194, 93, 0.4, -0.1),
                       (2252, 86, 0.5, 0.15), (2256, 90, 0.4, -0.2), (2260, 93, 0.35, 0.25), (2266, 98, 0.25, 0.0)]:
        mx.add("keys", mallet(m, v, rng, 2.4, "celesta"), F(f), -31, p, {"hall": -4})
    for f, m in [(2252, 50), (2252, 57), (2256, 62), (2260, 66)]:
        mx.add("keys", st(piano(m, 0.42, rng, 3.5, 2400)), F(f), -28, 0.0, {"hall": -5})


def main():
    t0 = time.time()
    act = vo_activity()  # float32, computed first while RAM is free
    clear_activity()
    rng = np.random.default_rng(7701)
    hall = make_ir(2.6, 77, predelay=0.03, damp_hz=3800, hi_ratio=0.45, lowcut=150)
    big = make_ir(4.0, 78, predelay=0.04, damp_hz=3000, hi_ratio=0.5, lowcut=100)
    mx = ClipMixer({"hall": (hall, "verb_hall"), "big": (big, "verb_big")})
    for fn in (build_morning, build_hours, build_day1, build_day2, build_day3, build_fade, build_lifetime, build_resolve):
        fn(mx, rng)
        print(f"  {fn.__name__:16s} {time.time() - t0:5.1f}s")
    # hard cut into the rewind: every clip crossing 1888 is cut there (8 ms)
    s_cut = idx(F(F_CUT))
    k = idx(0.008)
    for bus, cl in mx.clips.items():
        for i, (a0, x) in enumerate(cl):
            if a0 < s_cut < a0 + len(x):
                x = x[: s_cut - a0].copy()
                m = min(k, len(x))
                x[len(x) - m:] *= (np.cos(np.linspace(0, np.pi / 2, m)) ** 2)[:, None].astype(np.float32)
                cl[i] = (a0, x)
    mus = render_f32(mx)
    del mx
    filt_inplace(mus, sos("lp", 11000, 1))
    filt_inplace(mus, sos("hp", 40, 2))
    # S13 fog: the whole score sinks into a closing low-pass (1372 -> 1419), reopening on the day-3 hit
    a, b = idx(F(1360)), idx(F(1428))
    nseg = b - a
    cut = 9000 * 2 ** (keys([(0, 0), (F(1372 - 1360), 0), (F(1419 - 1360), -3.2), (F(1428 - 1360), -3.2)], nseg) )
    seg = tv_filter(mus[a:b].astype(np.float64), cut, "lp", [0.5412, 1.3066], block=128)
    xf = np.clip((np.arange(nseg) / SR - F(1423 - 1360)) / 0.03, 0, 1)[:, None]  # back to dry on the day-3 hit
    mus[a:b] = seg * (1 - xf) + mus[a:b] * xf
    # carve the speech band (300 Hz-4 kHz) a further SPEECH_CARVE_DB while the narration speaks, then duck
    e0 = idx(73.7)  # the end (VO out 73.6 s): only let the final chord bloom ~4 dB, not the full duck depth
    act[e0:] = np.maximum(act[e0:], (np.clip((np.arange(N - e0) / SR) / 0.5, 0, 1) * 0.45).astype(np.float32))
    out = np.zeros((N, 2), dtype=np.float32)
    duck_carve_into(out, mus, act, DUCK_DB["music"], SPEECH_CARVE_DB, db(MUSIC_GAIN))
    del mus, act
    # exact zero across the dip's black frame (S16 has faded out before it)
    a, b = idx(F(F_SILENT[0])), idx(F(F_SILENT[1]))
    kk = idx(0.02)
    out[a - kk:a] *= (np.cos(np.linspace(0, np.pi / 2, kk)) ** 2)[:, None]
    out[a:b] = 0.0
    out[b:b + kk] *= (np.sin(np.linspace(0, np.pi / 2, kk)) ** 2)[:, None]
    end_fade_tail(out)
    pth = PUB / "audio" / "music.wav"
    pk = np.max(np.abs(out))
    print(f"  pre-write peak {20*np.log10(pk):.2f} dBFS")
    if pk > db(-3.2):
        out *= db(-3.2) / pk
        print(f"  (trimmed {20*np.log10(pk) + 3.2:.2f} dB)")
    write_wav(pth, out, seed=12)
    write_manifest()
    print(f"wrote {pth}  ({time.time() - t0:.1f}s)")
    section_report("music", out)


if __name__ == "__main__":
    main()
