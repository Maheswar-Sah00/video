"""What If You Stopped Drinking Water? -- sound design -> public/audio/sfx.wav
(48 kHz stereo, exactly DUR = 77.000 s = 2310 frames @ 30 fps).

Everything procedural (filtered noise, additive tones, envelopes, synthetic reverbs) and deterministic
(fixed seeds). Event-stream sync comes from src/sync-events.json (EV.sips, drips, alarms, throbs, beats,
stamps, shutdown, gulps -- the picture uses the very same frames); every other sound is placed by the
CUE TABLE below (one constant per beat, absolute frames) so a re-sync pass only edits that table.
Pre-ducked under the narration exactly as Remotion will mix it (audiolib.vo_activity: the VO runs almost
wall-to-wall, so the duck is mostly a constant offset that opens in the short gaps).

  S01  morning kitchen: fridge hum + room air, birds outside; a tiny slurp, two crisp gulps on EV.sips,
       a satisfied breath, the glass set down on stone (84, in the VO gap).
  S02  tap squeak + valve thunk as he shuts it, drips on EV.drips (112 140), the carton slide (122),
       THE LAST DROP 161 = a crystal plip + crown sparkle + long bright tail; a nervous swallow; the
       wall clock starts ticking at 214.
  CLOCK  a wall-clock tick/tock from 214 to the end of S15, faster every day (30 -> 24 -> 20 -> 16 f),
       softer under the heart scenes; S16 three last faint slowing ticks, then nothing.
  S03  x-ray hum, the xray scan, water filling (bubbly rising pour, settles), tiny leaks.
  S04  vapour exhales, a sweat bead trickling, the bladder drip.
  S05  time-lapse flutter whoosh, salt tinkle, a hypothalamus ping, the thirst ALARM (soft synth whoop)
       on EV.alarms, ADH capsules falling.
  S06  squelchy organic kidney flow, ADH docking, valve clicks (water pulled back), the dark low tone.
  DAYS each clock wipe (735/966/1410 -> EV.stamps 748/980/1423) = tick-tick + a circular whoosh + a
       deep D bell + stamp, heavier every day.
  S07  muffled office, sluggish typing, a dry sticky swallow, headache throbs on EV.throbs, a blur warble.
  S08  blood-flow rumble thickening, heartbeats on EV.beats (accelerating).
  S09  tissue bed, osmosis fizz, cells crinkling (papery) on 1074.
  S10  bathroom: fluorescent hum + tile reverb, the skin-pinch tick, an eyes-sink tone.
  S11  blazing street: cicadas, traffic, a car pass, heat-shimmer drone rising to 1259, thermometer.
  S12  evening living room, the sofa creak + cushion on standing up, a woozy pitch-bending swirl.
  S13  the brain: a foggy (closing low-pass) bed, the shrink groan, sputtering neural crackles, fog.
  S14  dull kidneys: the flow grinds to a halt on EV.shutdown (machine winding down), gloopy bubbles.
  S15  chest bed, the blood-pressure pitch fall on 'crashes', racing heartbeats then the stumble.
  S16  near-silence: bedroom tone, a far evening bird, curtain air, faint slow heartbeats, slow breaths,
       the long last breath out, then EXACT ZERO on the dip's black frame.
  S17  a faint caustic shimmer, sparse hourglass drops, the deep sub boom on 'three', the last drop;
       everything is cut hard at 1888.
  S18  tape REWIND: button clunk, the reel's own sound + narration garbled backwards at ~20x (pitchy
       chatter), a motor 'wheee', the HUD-clock ratchet, the stop clack, the flash whoomp at 1988.
  S19  x-ray body drinking: big gulps on EV.gulps + splashes, a rising fill, cells plumping, shimmer.
  S20  kitchen again (birds livelier), a contented 'ahh', the glass clink toward the camera, a text drip;
       fades to exact zero with the picture (2274-2310).

Buses: "<group>_<name>"; the group selects the duck depth (audiolib.DUCK_DB) and the extra speech-band
carve (SPEECH_DUCK_DB). The S18 garble reads public/audio/music.wav if present -> run music.py first.
Run:  python scripts/sfx.py [--buses [--report-only]]   (per-bus peaks per scene)
"""
from __future__ import annotations

import math
import re
import sys
import time

import numpy as np

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from audiolib import (DUCK_DB, EV, FPS, MK, N, PUB, SCENES, SR, ClipMixer, bell, bp, brown, clear_activity,  # noqa: E402
                      db, duck_carve_into, end_fade_tail, env_ad, fade_edges, filt_inplace, fsec, glide, grains, hp,
                      idx, keys, keys_db, load_vo_mono, lp, make_ir, osc, pink, rbj, render_f32, saw_blep,
                      section_report, smooth_rand, sos, to_stereo, transitions, tv_filter, vo_activity, white,
                      write_manifest, write_wav)
from scipy import signal  # noqa: E402

SEED = 77200

# =============================================================================================
# CUE TABLE -- absolute frames (30 fps). The ONLY place hand-placed sounds are timed.
# Event streams (EV.*, from src/sync-events.json) are NOT here: change them in scripts/events.py.
# Tuples are (start, end) windows unless the comment says "hits".
# =============================================================================================
# --- S01 Hook ------------------------------------------------------------------------------
F_KITCHEN = (0, 258)            # morning kitchen room tone + birds (S01-S02), out under the x-ray scan
F_SLURP = 17                    # the glass touches his lips: a tiny sip intake (gulps = EV.sips 24 40)
F_AHH1 = 62                     # 'drink': a satisfied breath out as he lowers the glass
F_GLASS_DOWN = 84               # the glass set down on the stone counter (in the VO gap 2.65-3.05 s)
# --- S02 LastDrop --------------------------------------------------------------------------
F_STREAM = (86, 99)             # the thin tap stream (hiss), breaking 99-106 into loose drops (103 106)
F_TAP_SQUEAK = (89, 96)         # his hand pushes the lever shut ('No water@96')
F_TAP_STOP = 96                 # ... the valve seats: a metallic thunk   (drips = EV.drips 112 140 161)
F_CARTON = (120, 137)           # 'No juice@122': the carton slides out of frame (right)
F_DROP_SWELL = (142, 161)       # the last drop swells + stretches at the tap's mouth (faint rising tone)
F_LAST_DROP = EV["drips"][-1]   # 161 THE LAST DROP (crystal plip + crown + long tail)
F_PLINKS = (170, 173, 176)      # hits: the rebound jet plinks after the last drop
F_TILT = (176, 194)             # the fast tilt up to his face (whoosh)
F_SWALLOW2 = 189                # the dry gulp (184-198), a touch worried
F_CLOCK_START = MK["clockStart"]  # 214 the wall clock starts ticking
# --- the clock (tick/tock grid): (anchor, stop before, period frames, level offset dB). The hours
# grid ticks ON its anchor (214); the day grids are anchored on the stamp (= the bell, the downbeat)
# and tick from anchor + period. music.py uses the same grids (its beat = one tick).
CLOCK_SEGS = [(214, 734, 30, 0.0),    # 'a few hours': 1 tick / s (60 bpm) = the S02 wall clock
              (780, 871, 30, 0.5),    # day 1 at the desk: the S07 desk clock (abs multiples of 30)
              (892, 965, 24, 0.5),    # day 1 S08 (75 bpm, grid 748 + 24k)
              (1000, 1409, 20, 1.0),  # day 2 (90 bpm, grid 980 + 20k)
              (1439, 1641, 16, 1.5)]  # day 3 (112.5 bpm, grid 1423 + 16k), through S15
CLOCK_DIP = [(871, 984, -7.0), (1527, 1646, -8.0)]  # softer under the heart scenes (S08, S15)
CLOCK_S16 = (1652, 1680, 1710)  # hits: S16 three last faint, slowing ticks -- then the clock is gone
# --- day stamps: (clock-wipe start, stamp frame = EV.stamps) --------------------------------
F_WIPES = [(735, EV["stamps"][0]), (966, EV["stamps"][1]), (1410, EV["stamps"][2])]
# --- S03 BodyWater -------------------------------------------------------------------------
F_MED = ((242, 753), (1319, 1658), (1982, 2134))  # x-ray 'medical' hum bed spans (S03-S06, S13-S15, S19)
F_FILL = (284, 319)             # the water rises feet -> 60 % (284-318), overshoot peak ~319, settles
F_LEAKS = (342, 364)            # 'always leaking out': tiny vapour hisses + micro drips
# --- S04 Leaking ---------------------------------------------------------------------------
F_EXHALES = (384, 428, 472)     # hits: aqua vapour puffs from the mouth
F_SWEAT = (398, 446)            # sweat beads form 398-420, trickle from F_TRICKLE, drop at the end
F_TRICKLE = 421
F_BLADDER = (466, 473, 480, 488)    # hits: the bladder's schematic drips ('bathroom@466')
# --- S05 Thirst ----------------------------------------------------------------------------
F_TIMELAPSE = (494, 524)        # 'A few hours in': time-lapse flutter
F_SALT = (536, 562)             # 'saltier@541': salt cubes crowd in (crystal tinkle, peak 541)
F_HYPO = 566                    # 'brain@571': the hypothalamus highlights (soft ping)  (alarms = EV.alarms)
F_ZAPS = (604, 616, 628)        # hits: nerve sparks hit the mouth/throat (electric zaps)
F_ADH = (617, 643)              # violet ADH capsules pop out every ~2.4 f, falling (descending soft blips)
# --- S06 Kidneys ---------------------------------------------------------------------------
F_KFLOW = (626, 753)            # squelchy organic kidney flow bed
F_ADH_DOCK = (641, 660)         # 12 ADH docking clicks (~every 1.7 f) on the kidneys
F_VALVES = (660, 662, 664, 667, 669, 671)  # hits: aquaporin gates open (valve clicks + sucks)
F_CHART = (703, 717)            # the urine-chart marker slides pale -> dark
F_DARK = 719                    # 'dark@719': the low dark tone
# --- S07 DayOne ----------------------------------------------------------------------------
F_OFFICE = (735, 886)           # muffled office / desk room tone
F_TYPING = (756, 771)           # a few sluggish key taps
F_DRY_SWALLOW = 785             # 'sticky@786': a dry, sticky swallow  (throbs = EV.throbs 815 829 843)
F_WARBLE = (844, 877)           # 'can't think straight': the blur warble (peak ~850)
# --- S08 ThickBlood ------------------------------------------------------------------------
F_FLOW8 = (871, 985)            # inside the vessel: blood-flow rumble (pulses with EV.beats)
F_THICKEN = (885, 920)          # 'thickens@894': the flow goes thick and slow
# --- S09 Shrivel ---------------------------------------------------------------------------
F_TISSUE = (966, 1106)          # tissue bed
F_OSMOSIS = (1005, 1052)        # water streaming out of the cells (fizz, centre -> capillary)
F_CRINKLE = (1068, 1100)        # 'shrivel@1074': the cells crinkle (soft papery crumple, peak ~1074)
# --- S10 Mirror ----------------------------------------------------------------------------
F_BATH = (1087, 1187)           # bathroom tone + fluorescent hum
F_PINCH = 1109                  # his fingers pinch the back of his hand (soft skin-grab tick)
F_PINCH_RELEASE = 1121          # 'bounce@1126': let go -- the fold stays tented (dry tick + slow sink)
F_EYES_SINK = 1161              # 'sink@1161': a soft low sinking tone
# --- S11 Overheat --------------------------------------------------------------------------
F_STREET = (1174, 1267)         # cicadas + traffic + heat-shimmer drone rising to 1259
F_CAR_PASS = 1200               # a car passing behind him
F_THERMO = (1210, 1252)         # the thermometer pops (1210) and rises 37.0 -> 39.5 C
F_STEPS = (1174, 1197, 1220, 1243)  # hits: his slow footfalls
# --- S12 Dizzy -----------------------------------------------------------------------------
F_LIVING = (1252, 1334)         # evening living room tone
F_SOFA = (1257, 1284)           # leans + rises from the sofa: creak peak ~1264, cushion, cloth
F_GRIP = (1302, 1315)           # his hand grips the bookcase: thud + rattle
F_SWIRL = (1286, 1330)          # 'the whole room spins@1301': the woozy swirl
# --- S13 BrainShrink -----------------------------------------------------------------------
F_BRAIN = (1319, 1428)          # brain bed with a closing 'fog' low-pass
F_GROAN = (1338, 1368)          # 'shrinks@1345': the low shrink groan
F_SPUTTER = (1372, 1419)        # 'thoughts@1375 turn to fog': neuron sparks sputter + stall
F_FOG = 1393                    # 'fog@1393': a muffled fog whoosh
# --- S14 KidneysFail -----------------------------------------------------------------------
F_KFLOW14 = (1410, 1544)        # the dull kidneys' flow (slower), stops at EV.shutdown
F_WINDDOWN = (1440, EV["shutdown"][0])  # the filtering machine winds down -> halts on 1465
F_KPULSES = (1428, 1440, 1451, 1459)  # hits: weakening kidney pulses (laboured thumps)
F_NO_URINE = 1474               # the 'NO URINE' stamp
F_GLOOP = (1485, 1532)          # 'Poisons build up': thick gloopy bubbles
# --- S15 Heart -----------------------------------------------------------------------------
F_CHEST = (1527, 1658)          # chest bed (heartbeats = EV.beats 1529..1606, stumble 1619 1625 1640)
F_PFALL = (1551, 1580)          # 'pressure@1548 crashes@1557': the pressure pitch fall (needle drops)
# --- S16 Fade ------------------------------------------------------------------------------
F_BEDROOM = (1634, 1772)        # bedroom evening tone (near-silent)   (beats = EV.beats 1660 1690 1722)
F_EVE_BIRD = 1648               # a single far evening bird outside
F_BREATHS16 = ((1646, 1660, 1682), (1676, 1692, 1712), (1708, 1724, None))  # (inhale start, peak = exhale start, exhale end)
F_LAST_BREATH = (1730, 1766)    # the long last breath out (1731-1748 + tail), then stillness
F_SILENCE = (1773, 1783)        # EXACT digital silence (the black frame of the dip 1763-1793)
# --- S17 Lifetime --------------------------------------------------------------------------
F_CAUSTIC = (1783, 1888)        # faint caustic shimmer
F_HOURGLASS = (1787, 1793, 1800, 1807, 1815, 1824, 1833, 1843, 1854, 1866)  # hits: hourglass drop landings
F_SUB_BOOM = 1852               # 'three@1852': the deep sub boom
F_DROP17 = 1879                 # the very last drop
F_CUT = 1888                    # HARD CUT into the rewind: every sound crossing this frame is cut
# --- S18 Rewind ----------------------------------------------------------------------------
F_RW_BUTTON = 1889              # the tape 'ka-chunk' as the REWIND icon pops
F_RW_RUN = (1891, 1990)         # the rewind whirr: spin-up 1891-1900, replay 1900-1970, slows on the kitchen to ~1990
# the garble follows the picture: (abs a, abs b, source scene Sequence start, local l0 -> l1, easeOutCubic?)
# = src/scenes/S18Rewind.tsx REWIND_SEGMENTS (source starts = timing.ts RANGES)
RW_SEGS = [(1900, 1908, 1634, 120, 30, 0), (1908, 1914, 1527, 110, 20, 0), (1914, 1919, 1410, 110, 25, 0),
           (1919, 1924, 1252, 70, 10, 0), (1924, 1929, 1174, 80, 12, 0), (1929, 1934, 1087, 88, 15, 0),
           (1934, 1940, 966, 125, 30, 0), (1940, 1946, 735, 130, 20, 0), (1946, 1952, 482, 140, 25, 0),
           (1952, 1958, 242, 110, 30, 0), (1958, 1970, 81, 100, 22, 0), (1970, 1995, 0, 86, 6, 1)]
F_RW_STOP = 1986                # the stop clack as it lands on the morning kitchen
F_FLASH = 1988                  # the S18 -> S19 flash: bright soft whoomp + shimmer
# --- S19 Refill ----------------------------------------------------------------------------
F_FILL19 = (2010, 2075)         # the body's water level rising (gulps = EV.gulps 1996 2012 2028 2044 2060)
F_SPLASH19 = (2018, 2033, 2047, 2062, 2073)  # hits: the water splashes in / level steps up
F_PLUMP = (2064, 2073, 2082, 2091, 2100, 2108)  # hits: shrivelled cells plump back up (lens inset)
F_SHIMMER19 = (2059, 2124)      # the mint refill shimmer ('REFILLED' ~2104)
# --- S20 Closing ---------------------------------------------------------------------------
F_KITCHEN20 = (2116, 2310)      # bright kitchen again: fridge, birds (livelier)
F_GULP20 = 2121                 # his last gulp (2118-2128, in the VO gap)
F_LOWER20 = 2131                # the glass lowered (slosh)
F_AHH20 = 2140                  # the happy 'ahh'
F_RAISE = (2153, 2166)          # the glass raised toward the camera (whoosh)
F_WORDS = (2170, 2173, 2181, 2194)  # hits: closing text words pop
F_CLINK = 2165                  # he raises the glass toward the camera: a bright clink (pause after 'favour')
F_TEXT_DRIP = (2204, 2249, 2294)  # hits: drips off 'WATER.' every ~1.5 s

# ---- level table (dB). Beds: RMS dBFS at envelope 1 (before ducking). Events: peak dBFS before pan.
LV = dict(
    kitchen=-47, bird01=-39, slurp=-35, gulp=-16, ahh=-35, glassdown=-14,
    squeak=-30, valve=-24, drip=-19, lastdrop=-12, dropswell=-42, carton=-31, swallow=-27,
    clock=-35,
    med=-48, scan=-28, fill=-27, leak=-35,
    exhale=-29, sweat=-31, bladder=-26,
    timelapse=-28, salt=-30, hypo=-30, alarm=-21, adh=-33,
    kflow=-42, dock=-29, valves=-30, chart=-36, dark=-25,
    wipetick=-27, wipe=-28, bell=-22, stamp=-17,
    office=-48, typing=-37, dryswallow=-25, throb=-18, warble=-33,
    flow=-36, heartb=-18, thick=-33,
    tissue=-42, fizz=-35, crinkle=-31,
    bath=-47, fluoro=-49, pinch=-27, sink=-30,
    street=-43, cicada=-40, traffic=-47, heatdrone=-35, carpass=-35, thermo=-41,
    living=-48, sofa=-25, swirl=-31,
    brain=-45, groan=-23, sputter=-31, fog=-30,
    kflow14=-44, winddown=-27, gloop=-29,
    chest=-44, pfall=-27, heart15=-19,
    bedroom=-53, birdeve=-44, curtain=-52, heart16=-28, breath16=-39, lastbreath=-34,
    caustic=-53, hdrop=-31, subboom=-16, drop17=-20,
    rw=-21, rwwhine=-31, rwratchet=-33, rwclunk=-21, flash=-15,
    med19=-46, gulp19=-17, splash=-27, fill19=-31, shimmer=-35, plump=-29,
    kitchen20=-46, bird20=-35, ahh20=-30, clink=-19, textdrip=-30,
    whoosh=-31,
)
SFX_GAIN = 0.0
# extra speech-band (300 Hz-4 kHz) carve while the narration speaks, per group (on top of DUCK_DB)
SPEECH_DUCK_DB = {"amb": 8.0, "tex": 6.0, "body": 4.0, "bird": 4.0, "far": 4.0, "fx": 2.5, "hit": 3.0,
                  "tick": 1.5, "ui": 2.0, "tr": 3.0, "voc": 3.0, "heart": 2.0, "hero": 1.5, "rw": 5.0}


# =============================================================================================
# helpers
# =============================================================================================
def R(k):
    return np.random.default_rng(SEED + k)


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-12)


def rmsnorm(x):
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-12)


def rmsn_soft(x, crest=3.5):
    """RMS-normalise, then soft-limit the peaks to `crest` x RMS (tames sparse crackle/grain beds)."""
    y = rmsnorm(x)
    return crest * np.tanh(y / crest)


def bpq(x, f0, q):
    c = rbj("bp", f0, q)
    return signal.lfilter(c[:3], c[3:], x, axis=0)


def mid(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def pan_st(y, pan):
    p = np.clip(np.asarray(pan, dtype=np.float64), -1, 1)
    a = (p + 1) * np.pi / 4
    return np.stack([y * np.cos(a), y * np.sin(a)], 1)


def env_at(n, t0, attack, tau, release=0.01):
    e = np.zeros(n)
    s = idx(t0)
    if s < n:
        e[s:] = env_ad(n - s, attack, tau, release)
    return e


def click(n, at=0.0, width=0.0004):
    x = np.zeros(n)
    s, w = idx(at), max(2, idx(width))
    if s + w < n:
        x[s:s + w] = np.sin(np.linspace(0, np.pi, w))
    return x


def crackle(n, rate, rng, length=0.0004):
    return white(n, rng) * grains(n, rate, rng, length)


def word(line, w, nth=0):
    """Absolute frame of narration word `w` in line `line` (same rule as lib/sync.ts wordAt)."""
    nm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())  # noqa: E731
    return [x["f"] for x in EV["words"][line] if nm(x["w"]) == nm(w)][nth]


def seg_n(f0, f1):
    return idx(fsec(f1) - fsec(f0))


def lin_f(pts, f0, f1):
    """Smoothstep keys in absolute FRAMES evaluated on the local segment f0..f1."""
    return keys([(fsec(f) - fsec(f0), v) for f, v in pts], seg_n(f0, f1), 0.0)


def db_f(pts, f0, f1):
    """dB keys in absolute FRAMES on the local segment f0..f1 (<= -79 dB = exact 0)."""
    return keys_db([(fsec(f) - fsec(f0), v) for f, v in pts], seg_n(f0, f1), 0.0, floor=-79.0)


def put(buf, y, f_seg0, f, gain=1.0, pan=0.0):
    """Add y (mono or stereo) into a local segment buffer starting at frame f_seg0, at absolute frame f."""
    st = to_stereo(np.asarray(y, dtype=np.float64), pan) * gain
    s = idx(fsec(f) - fsec(f_seg0))
    a, b = max(0, s), min(len(buf), s + len(st))
    if b > a:
        buf[a:b] += st[a - s:b - s]


def add(mx, bus, y, f, lvl, pan=0.0, sends=None):
    mx.add(bus, y, fsec(f), lvl, pan, sends)


def mixin(y, x, at):
    """y[at:] += x (mono/stereo, clipped to len(y)); at in seconds."""
    s = idx(at)
    e = min(len(y), s + len(x))
    if e > s:
        y[s:e] += x[: e - s]
    return y


# =============================================================================================
# kernels (generic)
# =============================================================================================
def tone_blip(f0, f1, tau, d, rng, h2=0.3, glide_tau=None):
    """A clean pitched blip gliding f0 -> f1 (exponential, glide_tau), decaying with tau."""
    n = idx(d)
    t = np.arange(n) / SR
    fr = glide(f0, f1, n, glide_tau or tau * 0.3)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    y = (np.sin(ph) + h2 * np.sin(2 * ph + rng.random() * 6.283)) * np.exp(-t / tau)
    y *= np.sin(np.clip(t / 0.0006, 0, 1) * np.pi / 2) ** 2
    return fade_edges(y, 0.0, min(0.01, d / 4))


def glass_tick(f0, rng, decay=1.0, bright=1.0, attack=0.0008, dur=0.45):
    """Free glass bar: inharmonic partials (1, 2.76, 5.4, 8.93) + a tiny strike noise."""
    n = idx(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for r, a, tau in [(1.0, 1.0, 0.10), (2.76, 0.45, 0.035), (5.40, 0.22, 0.012), (8.93, 0.1, 0.006)]:
        if f0 * r < 15000:
            y += a * (bright if r > 1 else 1.0) * np.exp(-t / (tau * decay)) * np.sin(
                2 * np.pi * f0 * r * t + rng.random() * 6.283)
    y *= np.sin(np.clip(t / attack, 0, 1) * np.pi / 2) ** 2
    y += 0.25 * bright * norm(hp(white(n, rng), 3000, 2)) * env_ad(n, 0.0002, 0.0007, 0.0)
    return fade_edges(y, 0.0, 0.05)


def whoosh(rng, d, f0, f1, q=1.2, peak=0.35, body=0.4, stereo=False):
    """Band-passed noise swell with a gliding centre (stereo = decorrelated L/R)."""
    n = idx(d)
    fc = np.exp(keys([(0, math.log(f0)), (d * peak, math.log(f1)), (d, math.log(f0 * 0.8))], n))
    src = white(n, rng, 2 if stereo else None)
    y = tv_filter(src, fc, "bp", q, block=64) + body * lp(white(n, rng, 2 if stereo else None), 200, 2)
    e = bell(n, peak, 1.0, 1.6)
    y = y * (e[:, None] if stereo else e)
    return norm(fade_edges(y, 0.005, 0.03))


def creak(rng, d, f_res, r0=25, r1=55, f_end=None, peak=0.4):
    """Stick-slip creak: irregular impulse train through resonances (f_end: resonance glides)."""
    n = idx(d)
    t = np.arange(n) / SR
    rate = np.interp(t, [0, d], [r0, r1]) * (1 + 0.3 * smooth_rand(n, 8, rng, -1, 1))
    ph = np.cumsum(rate) / SR
    imp = np.zeros(n)
    imp[np.nonzero(np.diff(np.floor(ph), prepend=0))[0]] = 1.0
    imp *= rng.uniform(0.3, 1.0, n)
    ex = signal.lfilter([1, -0.6], [1], imp + 0.02 * white(n, rng))
    if f_end is None:
        y = bpq(ex, f_res, 7.0) + 0.6 * bpq(ex, f_res * 2.3, 9.0) + 0.3 * bpq(ex, f_res * 4.1, 10.0)
    else:
        fc = np.exp(np.linspace(math.log(f_res), math.log(f_end), n))
        y = tv_filter(ex, fc, "bp", 7.0, block=32) + 0.6 * tv_filter(ex, fc * 2.3, "bp", 9.0, block=32)
    return norm(fade_edges(y * bell(n, peak, 1.2, 1.4), 0.01, 0.05))


def breath(rng, d, inhale=True, f1=700, f2=1500, bright=1.0, peak=None):
    n = idx(d)
    src = white(n, rng)
    y = bpq(src, f1, 2.5) + 0.7 * bpq(src, f2, 3.0) + 0.45 * bright * bpq(src, 2700, 3.5) + 0.2 * bright * hp(src, 4000, 2)
    pk = peak if peak is not None else (0.65 if inhale else 0.3)
    y = hp(y, 200, 2) * bell(n, pk, 1.2, 1.6)
    return norm(fade_edges(y, 0.005, 0.03))


def reverse_swell(rng, d=0.32, lo=600, hi=5000):
    n = idx(d)
    t = np.arange(n) / SR
    fc = np.exp(np.linspace(math.log(lo), math.log(hi), n))
    y = tv_filter(white(n, rng), fc, "bp", 1.2) * (t / d) ** 2.5
    return norm(fade_edges(y, 0.01, 0.004))


def xray_scan(rng, d, up):
    """Glassy scan line sweeping the frame: band noise + a shimmering pure tone + air."""
    n = idx(d)
    t = np.arange(n) / SR
    a, b = (700, 4200) if up else (4200, 700)
    fc = np.exp(np.linspace(math.log(a), math.log(b), n))
    nz = tv_filter(white(n, rng), fc, "bp", 2.5)
    tone = osc(fc * 0.5, n) * (0.7 + 0.3 * np.sin(2 * np.pi * 28 * t))
    sh = sum(osc(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * t + i)), n) for i, f in enumerate((2637, 3520, 4699))) / 3
    env = bell(n, 0.5, 1.4, 1.4)
    y = (norm(nz) + 0.4 * norm(tone) + 0.25 * norm(sh)) * env + 0.3 * norm(lp(white(n, rng), 300, 2)) * env
    return norm(fade_edges(y, 0.01, 0.02))


def thud(rng, f0=60, f1=30, tau=0.35, d=2.0, knock=0.5, knock_f=180):
    """Soft deep thud: pitched sine drop + low noise knock."""
    n = idx(d)
    body = osc(glide(f0, f1, n, 0.06), n) * env_ad(n, 0.003, tau, 0.1)
    body += 0.4 * osc(glide(2 * f0, 2 * f1, n, 0.05), n) * env_ad(n, 0.003, tau * 0.5, 0.1)
    kn = norm(bpq(white(n, rng), knock_f, 1.2)) * env_ad(n, 0.001, 0.03)
    return norm(fade_edges(np.tanh(1.6 * (norm(body) + knock * kn)), 0.0, 0.1))


def bubble(rng, f0, tau=None, rise=0.25):
    """Clean glassy blip (Minnaert-style damped sine whose pitch rises as it leaves)."""
    tau = tau or rng.uniform(0.008, 0.03) * (800 / f0) ** 0.5
    n = idx(min(0.4, 6 * tau) + 0.003)
    t = np.arange(n) / SR
    fr = f0 * (1 + rise * np.minimum(t / (3 * tau), 1))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / tau)
    y *= np.sin(np.clip(t / 0.0008, 0, 1) * np.pi / 2) ** 2
    return fade_edges(y, 0.0, 0.002)


def heartbeat(rng, cut=260.0, drive=1.8, kg=0.55, ds=1.0, dub=0.2, dub_amt=0.6):
    """Lub-dub: two pitched low thumps (the 'lub' at sample 0, the 'dub' `dub` s later)."""
    n = int(0.9 * SR)

    def thump(f0, f1, tau):
        fr = glide(f0, f1, n, 0.035 * ds)
        ph = 2 * np.pi * np.cumsum(fr) / SR
        tone = (np.sin(ph) + 0.55 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * env_ad(n, 0.007, tau * ds)
        nz = norm(lp(white(n, rng), 180, 2)) * env_ad(n, 0.004, tau * 0.4 * ds)
        knock = norm(bpq(white(n, rng), 210, 1.4)) * env_ad(n, 0.003, tau * 0.45 * ds)
        return tone + 0.3 * nz + kg * knock

    y = thump(64, 46, 0.06)
    dd = idx(dub)
    if dub_amt > 0:
        y[dd:] += dub_amt * thump(78, 56, 0.045)[: n - dd]
    y = hp(lp(np.tanh(y * drive) / drive, cut * 1.5, 2), 32, 2)
    return norm(fade_edges(y, 0.0, 0.1))


def clock_tick(rng, tock=False, bright=1.0):
    """Wall-clock escapement: a sharp click through case resonances + a woody body + a faint echo."""
    n = idx(0.09)
    c = click(n, 0.0, 0.00025)
    f = (3150, 5050, 7400) if not tock else (2750, 4400, 6600)
    y = norm(sum(bpq(c, fr, 16) * (0.8 ** i) for i, fr in enumerate(f))) * bright
    y = y + 0.45 * norm(bpq(c, 1250 if not tock else 1080, 6))
    s = idx(0.011)
    y[s:] += 0.22 * y[: n - s]
    return norm(fade_edges(y, 0.0, 0.02))


def ding(rng, f0, d=1.6, stereo_detune=1.5, decay=1.0):
    """Crisp clean ding (bell-ish UI tone): partials 1, 2, 3, 4.16, 5.43 + a strike click."""
    n = idx(d)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for c, cents in enumerate((-stereo_detune, stereo_detune)):
        f = f0 * 2 ** (cents / 1200)
        y = np.zeros(n)
        for r, a, tau in [(1, 1.0, 0.9), (2.0, 0.32, 0.4), (3.0, 0.12, 0.2), (4.16, 0.08, 0.1), (5.43, 0.05, 0.06)]:
            if f * r < 16000:
                y += a * np.exp(-t / (tau * decay)) * np.sin(2 * np.pi * f * r * t + c * 0.7)
        out[:, c] = y
    out *= (np.sin(np.clip(t / 0.0008, 0, 1) * np.pi / 2) ** 2)[:, None]
    clk = hp(white(n, rng), 4000, 2) * np.exp(-t / 0.0007)
    out += 0.18 * norm(clk)[:, None]
    return fade_edges(out / np.max(np.abs(out)), 0.0, 0.2)


def sparkle_up(rng, f0=4200.0, k=3, gap=0.035):
    """A quick ascending glassy sparkle."""
    n = idx(gap * k + 0.25)
    y = np.zeros(n)
    for j in range(k):
        g = glass_tick(f0 * 2 ** (j * 4 / 12) * rng.uniform(0.98, 1.02), rng, 0.3, 0.4, dur=0.2)
        mixin(y, g * (0.6 + 0.4 * j / max(1, k - 1)), j * gap)
    return norm(y)


def chirp_note(rng, kind, f0, d=None):
    """One bird note. kinds: tweet (fast down-sweep), up (rising), whistle (fluty glide + vibrato),
    trill (fast AM), chip (tiny)."""
    if kind == "tweet":
        d = d or rng.uniform(0.04, 0.075)
    elif kind == "up":
        d = d or rng.uniform(0.06, 0.13)
    elif kind == "whistle":
        d = d or rng.uniform(0.16, 0.36)
    elif kind == "trill":
        d = d or rng.uniform(0.22, 0.45)
    else:
        d = d or rng.uniform(0.02, 0.035)
    n = idx(d)
    t = np.arange(n) / SR
    u = np.linspace(0, 1, n)
    if kind == "tweet":
        fr = f0 * (1.35 - 0.6 * u)
        env = bell(n, 0.25, 1.0, 1.5)
    elif kind == "up":
        fr = f0 * (0.78 + 0.45 * u ** 1.5)
        env = bell(n, 0.65, 1.2, 1.1)
    elif kind == "whistle":
        bend = rng.uniform(-0.15, 0.2)
        fr = f0 * (1 + bend * np.sin(np.pi * u)) * (1 + 0.012 * np.sin(2 * np.pi * rng.uniform(18, 30) * t))
        env = bell(n, rng.uniform(0.2, 0.45), 1.3, 1.8)
    elif kind == "trill":
        fr = f0 * (1.05 - 0.12 * u)
        env = bell(n, 0.3, 1.0, 1.4) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(18, 28) * t)) ** 3
    else:
        fr = f0 * (1.12 - 0.25 * u)
        env = bell(n, 0.4, 1.0, 1.2)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    y = np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.04 * np.sin(3 * ph)
    return fade_edges(y * env, 0.001, 0.004)


SPECIES = {
    # name: (base Hz range, note kinds, notes per phrase, note rate Hz)
    "sparrow": ((3300, 4800), ("tweet", "tweet", "chip", "up"), (3, 7), (7, 10)),
    "tit": ((3600, 4600), ("up", "tweet"), (4, 6), (5, 6.5)),
    "robin": ((2600, 5200), ("whistle", "trill", "tweet", "up"), (4, 7), (3.5, 5)),
    "finch": ((3800, 5200), ("trill", "chip", "chip", "tweet"), (3, 6), (6, 9)),
    "blackbird": ((1700, 2900), ("whistle", "whistle", "up"), (3, 5), (2.2, 3.2)),
}


def bird_phrase(rng, species):
    (lo, hi), kinds, (k0, k1), (r0, r1) = SPECIES[species]
    k = int(rng.integers(k0, k1 + 1))
    rate = rng.uniform(r0, r1)
    base = rng.uniform(lo, hi)
    notes = []
    t = 0.0
    alt = 0
    for j in range(k):
        if species == "tit":
            kind = kinds[alt % 2]
            f = base * (1.0 if alt % 2 == 0 else 0.8)
            alt += 1
        else:
            kind = kinds[int(rng.integers(0, len(kinds)))]
            f = base * rng.uniform(0.8, 1.2)
        y = chirp_note(rng, kind, f)
        notes.append((t, y * rng.uniform(0.6, 1.0)))
        t += max(len(y) / SR + 0.015, 1.0 / rate * rng.uniform(0.85, 1.15))
    n = idx(t + 0.5)
    out = np.zeros(n)
    for a, y in notes:
        mixin(out, y, a)
    return out


def bird_bed(rng, d, rate, species, pan_range=0.85, dist=1.0):
    """Stereo birdsong over d seconds: phrases at Poisson-ish times, distance = low-pass + level."""
    n = idx(d)
    out = np.zeros((n, 2))
    t = rng.uniform(0, 0.4)
    while t < d - 0.3:
        sp = species[int(rng.integers(0, len(species)))]
        y = bird_phrase(rng, sp)
        far = rng.uniform(0.0, 1.0) * dist
        y = lp(y, 9000 - 5000 * far, 2) * (1.0 - 0.6 * far)
        mixin(out, pan_st(y, rng.uniform(-pan_range, pan_range)), t)
        t += rng.exponential(1.0 / max(rate, 1e-3)) + len(y) / SR * 0.5
    return out


def city(rng, n):
    return rmsnorm(lp(brown(n, rng, 2), 240, 2) + 0.4 * rmsnorm(bp(pink(n, rng, 2), 180, 900, 2))) \
        * smooth_rand(n, 0.15, rng, 0.75, 1.0)[:, None]


# =============================================================================================
# kernels (this story)
# =============================================================================================
def gulp(rng, size=1.0, wet=1.0):
    """A swallow of water, close-mic'd: tongue click, the throat 'glk' (a resonant tone gliding down),
    a low throat thump, and water: a few bubbles + a soft liquid swish. Onset = sample 0."""
    d = 0.4
    n = idx(d)
    t = np.arange(n) / SR
    clk = bp(white(n, rng), 1200, 5000, 2) * np.exp(-t / 0.0025)
    fr = glide(430 / size, 205 / size, n, 0.035)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    glk = (np.sin(ph) + 0.35 * np.sin(2 * ph + 0.7)) * env_ad(n, 0.004, 0.045)
    thump = osc(glide(125, 66, n, 0.03), n) * env_ad(n, 0.003, 0.055 * size)
    y = 0.35 * norm(clk) + norm(glk) + 0.75 * norm(thump)
    if wet > 0:
        for _ in range(5):
            b = bubble(rng, rng.uniform(520, 1300), rng.uniform(0.006, 0.014), 0.5)
            mixin(y, wet * rng.uniform(0.12, 0.32) * b, rng.uniform(0.01, 0.1))
        y += wet * 0.22 * norm(bp(white(n, rng), 250, 1400, 2) * bell(n, 0.22, 1.0, 1.8))
    y *= np.sin(np.clip(t / 0.0005, 0, 1) * np.pi / 2) ** 2
    return norm(lp(fade_edges(y, 0.0, 0.06), 5200, 2))


def dry_swallow(rng):
    """A dry, sticky swallow: two sticky tongue/lip clicks, then a strained, waterless 'glk' + throat.
    The main glk is at 0.14 s (place at frame - 0.14 s)."""
    n = idx(0.6)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for at, f, a in ((0.0, 2600, 0.5), (0.055, 1900, 0.4), (0.1, 3100, 0.3)):
        k = bpq(click(idx(0.03), 0, 0.0004), f, 3.0)
        mixin(y, a * norm(k), at)
    g = gulp(rng, 1.15, 0.0)
    mixin(y, 0.9 * g, 0.14)
    y += 0.15 * norm(bp(white(n, rng), 600, 2500, 2)) * env_at(n, 0.14, 0.01, 0.05)
    return norm(lp(fade_edges(y, 0.0, 0.05), 4500, 2))


def glass_down(rng):
    """A glass (a sip left in it) set down on stone: contact click, a stone 'tock', a damped glass ring,
    a small water slosh, a soft low weight; and a smaller settle contact 45 ms later."""
    d = 1.2
    n = idx(d)
    t = np.arange(n) / SR

    def contact(scale):
        tock = bpq(white(n, rng), 1150, 2.5) * np.exp(-t / 0.005) + 0.7 * bpq(white(n, rng), 430, 2.0) * np.exp(-t / 0.012)
        clk = hp(click(n, 0, 0.0003), 3000, 2)
        ring = sum(a * np.exp(-t / (tau * scale)) * np.sin(2 * np.pi * f * t + rng.random() * 6)
                   for f, a, tau in ((1480, 1.0, 0.22), (3410, 0.5, 0.09), (5960, 0.25, 0.04), (8300, 0.1, 0.02)))
        low = osc(glide(110, 70, n, 0.02), n) * env_ad(n, 0.002, 0.035)
        return norm(tock) + 0.5 * norm(clk) + 0.32 * norm(ring) + 0.6 * norm(low)

    y = contact(1.0)
    y2 = contact(0.6)
    mixin(y, 0.28 * y2, 0.045)
    y += 0.25 * norm(bp(white(n, rng), 300, 1600, 2) * env_at(n, 0.012, 0.03, 0.09))
    for _ in range(3):
        mixin(y, 0.12 * bubble(rng, rng.uniform(700, 1500), 0.008, 0.4), rng.uniform(0.02, 0.12))
    y *= np.sin(np.clip(t / 0.0003, 0, 1) * np.pi / 2) ** 2
    return norm(fade_edges(y, 0.0, 0.2))


def tap_squeak(rng, d):
    """The rubber washer squealing as the tap is twisted shut: a stick-slip pulse train at the squeal
    pitch (wobbling, rising then settling) through metal-body resonances."""
    n = idx(d)
    u = np.linspace(0, 1, n)
    f = 480 * (1 + 0.3 * np.sin(np.pi * u ** 0.8)) * (1 + 0.035 * smooth_rand(n, 30, rng, -1, 1))
    ph = np.cumsum(f) / SR
    imp = np.zeros(n)
    imp[np.nonzero(np.diff(np.floor(ph), prepend=0))[0]] = 1.0
    imp *= rng.uniform(0.55, 1.0, n)
    y = bpq(imp, 1050, 6) + 0.6 * bpq(imp, 2300, 8) + 0.3 * bpq(imp, 3700, 9)
    env = bell(n, 0.45, 1.3, 1.5) * (0.55 + 0.45 * smooth_rand(n, 22, rng, 0, 1))
    return norm(fade_edges(y * env, 0.006, 0.02))


def valve_thunk(rng):
    """The tap valve seating: a pipe knock + a short metallic ring + a click."""
    n = idx(0.8)
    t = np.arange(n) / SR
    knock = bpq(white(n, rng), 190, 3) * np.exp(-t / 0.02)
    metal = sum(a * np.exp(-t / tau) * np.sin(2 * np.pi * f * t + rng.random() * 6)
                for f, a, tau in ((612, 1, 0.12), (1490, 0.5, 0.06), (2730, 0.3, 0.03), (4120, 0.15, 0.015)))
    clk = hp(click(n, 0, 0.0004), 2000, 2)
    y = norm(knock) + 0.28 * norm(metal) + 0.4 * norm(clk)
    y *= np.sin(np.clip(t / 0.0004, 0, 1) * np.pi / 2) ** 2
    return norm(fade_edges(y, 0.0, 0.1))


def plip(rng, f0=1400.0, tau=0.03, rise=0.65, crown=0, sparkle=0.0, d=0.9):
    """A water drop: an impact tick + the Minnaert 'plip' (rising damped sine) + optional crown splash
    (micro droplets) + a glassy sparkle. Onset = sample 0."""
    n = idx(d)
    y = np.zeros(n)
    mixin(y, norm(bubble(rng, f0, tau, rise)), 0.0)
    y += 0.22 * norm(hp(click(n, 0, 0.00025), 2500, 2))
    for _ in range(crown):
        bb = bubble(rng, rng.uniform(2400, 5400), rng.uniform(0.003, 0.007), 0.45)
        mixin(y, rng.uniform(0.07, 0.22) * norm(bb), rng.uniform(0.012, 0.12))
    if sparkle:
        for j, (fq, at) in enumerate(((5274, 0.018), (7040, 0.045), (6272, 0.08))):
            mixin(y, sparkle * (0.5 - 0.12 * j) * glass_tick(fq, rng, 1.6, 0.4, dur=0.5), at)
    return norm(fade_edges(y, 0.0, 0.1))


def carton_slide(rng, d):
    """A juice carton pushed along the stone counter: rough cardboard friction + a low rumble + the juice
    sloshing inside at the start."""
    n = idx(d)
    rough = 0.45 + 0.55 * smooth_rand(n, 55, rng, 0, 1)
    fr = bp(white(n, rng) * rough, 500, 3500, 2) + 0.5 * bp(white(n, rng) * grains(n, 260, rng, 0.0012) * 3, 800, 5000, 2)
    rum = lp(brown(n, rng), 240, 2)
    sl = bp(white(n, rng), 200, 900, 2) * env_at(n, 0.02, 0.05, 0.12)
    y = (norm(fr) + 0.35 * norm(rum)) * bell(n, 0.3, 1.2, 1.4) + 0.4 * norm(sl)
    return norm(fade_edges(y, 0.01, 0.04))


def day_bell(rng, f1=146.83, d=5.0, weight=1.0):
    """A deep tuned bell (D3 prime): hum, prime, minor tierce, quint, nominal ... slightly detuned L/R
    (beating), soft strike, low-passed (dark, not a chime)."""
    n = idx(d)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    parts = [(0.5, 0.75, 3.4), (1.0, 1.0, 2.3), (1.19, 0.42, 1.6), (1.5, 0.26, 1.1), (2.0, 0.42, 0.9),
             (2.51, 0.16, 0.55), (3.0, 0.12, 0.4), (4.07, 0.06, 0.25)]
    for c in (0, 1):
        y = np.zeros(n)
        for r, a, tau in parts:
            fr = f1 * r * (1 + (0.0011 if c else -0.0011))
            y += a * np.exp(-t / (tau * weight)) * np.sin(2 * np.pi * fr * t + rng.random() * 6)
        out[:, c] = y
    out += 0.22 * norm(lp(white(n, rng), 1400, 2) * np.exp(-t / 0.008))[:, None]
    out *= (np.sin(np.clip(t / 0.002, 0, 1) * np.pi / 2) ** 2)[:, None]
    out = lp(out, 2200, 2)
    return fade_edges(out / np.max(np.abs(out)), 0.0, 0.4)


def wipe_whoosh(rng, d):
    """The clock-wipe: the glowing hand sweeps once round from 12 o'clock (pan follows the hand)."""
    n = idx(d)
    fc = np.exp(keys([(0, math.log(500)), (d * 0.75, math.log(2600)), (d, math.log(1700))], n))
    y = tv_filter(white(n, rng), fc, "bp", 1.6, block=64) + 0.25 * lp(white(n, rng), 300, 2)
    e = bell(n, 0.72, 1.4, 1.2)
    pan = 0.8 * np.sin(np.linspace(0, 2 * np.pi, n))
    return pan_st(norm(fade_edges(y * e, 0.005, 0.03)), pan)


def alarm_whoop(rng, whoop=1.0, zing=0.4, d=0.5):
    """The thirst alarm: a soft synth 'whoop' (430 -> 950 Hz, eased, vibrato), an electric zing + a
    radiating ring shimmer, and a low pulse for the ring's push. Rounded, not harsh."""
    n = idx(d)
    t = np.arange(n) / SR
    u = np.clip(t / 0.16, 0, 1)
    u = u * u * (3 - 2 * u)
    f = (430 + 520 * u) * (1 + 0.012 * np.sin(2 * np.pi * 7 * t) * np.clip((t - 0.12) / 0.1, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.3 * np.sin(2 * ph + 0.5) + 0.1 * np.sin(3 * ph + 1)
    env = np.sin(np.clip(t / 0.03, 0, 1) * np.pi / 2) ** 2 * np.exp(-np.maximum(t - 0.2, 0) / 0.09)
    zz = hp(crackle(n, 6000, rng, 0.00015), 4000, 2) * env_ad(n, 0.002, 0.08)
    ring = (osc(2637, n) + 0.6 * osc(3520 * 1.003, n, 1)) * env_ad(n, 0.01, 0.18) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t))
    sub = osc(glide(110, 60, n, 0.05), n) * env_ad(n, 0.004, 0.12)
    y = whoop * norm(tone * env) + zing * (norm(zz) + 0.5 * norm(ring)) + 0.5 * norm(sub)
    return norm(lp(fade_edges(y, 0.0, 0.04), 6500, 2))


def throb(rng, d=0.55):
    """Headache throb: a muffled low pressure thump (felt more than heard)."""
    n = idx(d)
    y = osc(glide(72, 50, n, 0.1), n) + 0.4 * osc(glide(144, 100, n, 0.1), n)
    y = lp(np.tanh(1.6 * y), 260, 2) * env_ad(n, 0.025, 0.14, 0.05)
    y += 0.25 * lp(brown(n, rng), 120, 2) * env_ad(n, 0.02, 0.1)
    return norm(fade_edges(y, 0.0, 0.05))


def crinkle(rng, d, peak=0.25):
    """Soft papery crumple (cells shrivelling): dense dry grains through two bands, stereo."""
    n = idx(d)
    dens = bell(n, peak, 1.0, 1.6)
    out = np.zeros((n, 2))
    for c in (0, 1):
        gr = white(n, rng) * grains(n, 1.0, rng, 0.0004, 2600 * dens ** 1.5)
        out[:, c] = bp(gr, 1500, 7000, 2) + 0.45 * bp(gr, 450, 1500, 2)
    return out / (np.max(np.abs(out)) + 1e-12)


def wind_down(rng, d, stop_t):
    """A machine (the kidneys' filtering) grinding to a halt: motor hum + gear clicks slowing, the pitch
    sliding down, a last clunk exactly at stop_t (s)."""
    n = idx(d)
    t = np.arange(n) / SR
    u = np.clip(t / stop_t, 0, 1)
    rate = (1 - u ** 1.6) * (1 + 0.04 * np.sin(2 * np.pi * 5 * t))
    rate[t >= stop_t] = 0.0
    fm = 30 + 110 * rate
    motor = sum(osc(fm * k, n, k) / k for k in range(1, 6))
    motor = lp(motor * (0.85 + 0.15 * np.sin(2 * np.pi * np.cumsum(fm * 0.1) / SR)), 1600, 2)
    gph = np.cumsum(14 * rate) / SR
    imp = np.zeros(n)
    imp[np.nonzero(np.diff(np.floor(gph), prepend=0))[0][1:]] = 1.0
    gears = bpq(imp, 1700, 5) + 0.6 * bpq(imp, 3100, 7)
    grind = bp(white(n, rng), 300, 2500, 2) * (0.3 + 0.7 * rate)
    y = (rmsnorm(motor) + 0.4 * rmsnorm(grind)) * np.sqrt(rate) + 0.8 * norm(gears) * rate
    clunk = thud(rng, 120, 60, 0.06, 0.6, 0.8, 300)
    y = norm(y)
    mixin(y, 0.9 * clunk, stop_t)
    return norm(fade_edges(y, 0.02, 0.1))


def pressure_fall(rng, d):
    """Blood pressure crashing: a sine falling 820 -> 110 Hz (exponential), a falling whoosh + a soft
    deflating hiss."""
    n = idx(d)
    t = np.arange(n) / SR
    f = 110 + 710 * np.exp(-t / (d * 0.35))
    tone = osc(f, n) + 0.3 * osc(f * 2.003, n, 1)
    tone *= np.sin(np.clip(t / 0.03, 0, 1) * np.pi / 2) ** 2 * np.exp(-np.maximum(t - d * 0.5, 0) / (d * 0.25))
    w = whoosh(rng, d, 2200, 300, 1.0, 0.15, 0.4)
    hiss = hp(white(n, rng), 3000, 2) * bell(n, 0.2, 1.0, 1.8)
    return norm(norm(tone) + 0.55 * w + 0.15 * norm(hiss))


def room_bed(rng, n, lp_hz=900, hum=None, hum_amt=0.0):
    """Generic room tone: low-passed pink air (+ optional mains/appliance hum partials)."""
    y = rmsnorm(lp(pink(n, rng, 2), lp_hz, 2))
    if hum:
        t = np.arange(n) / SR
        h = sum(a * osc(f * (1 + 0.0008 * np.sin(2 * np.pi * 0.21 * t + k)), n, k) for k, (f, a) in enumerate(hum))
        h *= 0.85 + 0.15 * smooth_rand(n, 0.4, rng, 0, 1)
        y += hum_amt * rmsnorm(np.stack([h, 0.9 * h], 1))
    return y


def med_bed(rng, n, bright):
    """The x-ray 'medical glass' world: a thin mains hum, a faint high whine, airy hiss, drifting glassy
    partials (the glowing water) and a low warmth. bright: per-sample 0..1."""
    t = np.arange(n) / SR
    hum = osc(60, n) + 0.45 * osc(120.2, n, 1) + 0.2 * osc(180.3, n, 2)
    gl = np.zeros((n, 2))
    for f in (1568, 2093, 2349, 3136, 3951, 4699):
        a = smooth_rand(n, rng.uniform(0.08, 0.25), rng, 0.0, 1.0) ** 3
        gl += pan_st(osc(f * (1 + 0.002 * smooth_rand(n, 0.3, rng, -1, 1)), n, rng.random() * 6) * a, rng.uniform(-0.8, 0.8))
    air = bp(pink(n, rng, 2), 600, 6500, 2) * smooth_rand(n, 0.12, rng, 0.55, 1.0)[:, None]
    low = lp(brown(n, rng, 2), 100, 2)
    whine = osc(7040 * (1 + 0.002 * np.sin(2 * np.pi * 0.3 * t)), n)
    b = bright[:, None]
    return (0.3 * rmsnorm(np.stack([hum, hum], 1)) + 0.4 * rmsnorm(gl) * (0.4 + 0.6 * b) + rmsnorm(air) * (0.6 + 0.4 * b)
            + 0.8 * rmsnorm(low) + 0.05 * rmsnorm(np.stack([whine, whine], 1)))


def organic_flow(rng, n, speed=1.0, thick=0.0):
    """Squelchy organic flow (kidneys / blood): slowly modulated band noise + low brown body + soft
    viscous bubbles. speed scales the modulation, thick darkens it."""
    fc = 380 * (1 - 0.45 * thick) * (1 + 0.5 * smooth_rand(n, 1.2 * speed, rng, -1, 1))
    y = tv_filter(white(n, rng, 2), fc, "bp", 1.1, block=128)
    y = rmsnorm(y) * (0.6 + 0.4 * smooth_rand(n, 2.0 * speed, rng, 0, 1))[:, None]
    y += 0.9 * rmsnorm(lp(brown(n, rng, 2), 140, 2))
    bub = np.zeros((n, 2))
    for p in np.nonzero(rng.random(n) < 3.0 * speed / SR)[0]:
        b = bubble(rng, rng.uniform(260, 700) * (1 - 0.35 * thick), rng.uniform(0.02, 0.05), 0.25)
        e = min(n, p + len(b))
        bub[p:e] += pan_st(b[: e - p] * rng.uniform(0.3, 1.0), rng.uniform(-0.7, 0.7))
    return y + 0.35 * rmsn_soft(bub, 6.0)


# =============================================================================================
# builders
# =============================================================================================
def build_s01(mx):
    rng = R(1)
    f0, f1 = F_KITCHEN
    n = seg_n(f0, f1)
    bed = room_bed(rng, n, 1300, ((100, 1.0), (150.3, 0.5), (200.2, 0.35), (300.5, 0.15)), 0.45)
    g = db_f([(f0, -20), (4, 0), (236, 0), (250, -8), (f1, -79)], f0, f1)
    add(mx, "amb_kitchen", bed * g[:, None], f0, LV["kitchen"])
    birds = lp(bird_bed(rng, fsec(f1 - f0), 1.1, ("sparrow", "tit", "robin"), 0.8, 0.8), 7000, 2)
    add(mx, "bird_kitchen", norm(birds) * g[:, None], f0, LV["bird01"], 0.0, {"kitchen": -10})
    # the sip: a tiny airy intake as the glass meets his lips, then the two gulps (EV.sips)
    add(mx, "voc_slurp", lp(breath(rng, 0.22, True, 1200, 2600, 0.6, peak=0.7), 6000, 2), F_SLURP, LV["slurp"])
    for j, f in enumerate(EV["sips"]):
        add(mx, "hero_gulp", gulp(rng, 1.0 + 0.06 * j, 1.0), f, LV["gulp"] - 1.0 * j, 0.0, {"kitchen": -16})
    # 'ever drink': a satisfied breath out through the nose/mouth
    add(mx, "voc_ahh", lp(breath(rng, 0.75, False, 650, 1250, 0.4, peak=0.2), 3000, 2), F_AHH1, LV["ahh"])
    # the glass set down on the stone counter (in the VO gap) -- crisp
    add(mx, "hero_glass", glass_down(rng), F_GLASS_DOWN, LV["glassdown"], 0.05, {"kitchen": -9})


def build_s02(mx):
    rng = R(2)
    # the thin tap stream (hiss) until the lever shuts, then it breaks into loose drops
    a, b = F_STREAM
    nn = seg_n(a, b + 4)
    stm = bp(white(nn, rng), 1500, 7000, 2) * (0.8 + 0.2 * smooth_rand(nn, 30, rng, 0, 1))
    stm = stm * lin_f([(a, 0), (a + 3, 1), (99, 1), (b + 4, 0)], a, b + 4)
    add(mx, "fx_stream", norm(stm), a, LV["squeak"] - 4, -0.15, {"kitchen": -8})
    for j, f in enumerate((101, 103.5, 106)):
        add(mx, "fx_loose", plip(rng, 1900 + 200 * j, 0.01, 0.5, d=0.25), f, LV["drip"] - 9 - 2 * j, -0.15, {"kitchen": -8})
    for j, f in enumerate(F_PLINKS):  # the rebound jet plinks after the last drop
        add(mx, "fx_plink", plip(rng, 2600 + 300 * j, 0.008, 0.4, d=0.2), f, LV["drip"] - 8 - 2 * j, 0.1 * j, {"drop": -10})
    a, b = F_TILT  # the fast tilt up to his face
    add(mx, "tr_tilt", whoosh(rng, fsec(b - a) + 0.2, 500, 2200, 1.1, 0.5, 0.3), a, LV["whoosh"] - 2, 0.0, {"air": -10})
    a, b = F_TAP_SQUEAK
    add(mx, "fx_squeak", tap_squeak(rng, fsec(b - a)), a, LV["squeak"], -0.15, {"kitchen": -8})
    add(mx, "fx_valve", valve_thunk(rng), F_TAP_STOP, LV["valve"], -0.15, {"kitchen": -8})
    # the last drips (EV.drips): two plain drips, then THE LAST DROP
    for j, f in enumerate(EV["drips"][:-1]):
        y = plip(rng, 1650 - 120 * j, 0.022, 0.6, crown=2, d=0.5)
        add(mx, "hero_drip", y, f, LV["drip"] - 2.5 * j, -0.1, {"kitchen": -8, "drop": -16})
    # the drop swelling at the tap's mouth: a faint glassy rising tone, cut off by the fall
    a, b = F_DROP_SWELL
    d = fsec(b - a)
    nn = idx(d)
    tt = np.arange(nn) / SR
    sw = (osc(np.exp(np.linspace(math.log(2093), math.log(2793), nn)), nn) + 0.4 * osc(np.exp(np.linspace(math.log(4186), math.log(5587), nn)), nn, 1))
    sw *= (tt / d) ** 2 * (0.8 + 0.2 * np.sin(2 * np.pi * 6 * tt))
    add(mx, "tex_dropswell", norm(fade_edges(sw, 0.05, 0.012)), a, LV["dropswell"], -0.1, {"drop": -6})
    # THE LAST DROP: crystal plip + crown splash + sparkle + a long bright tail + a soft low bloom under it
    f = F_LAST_DROP
    y = plip(rng, 1320, 0.042, 0.72, crown=9, sparkle=0.45, d=1.6)
    add(mx, "hero_lastdrop", y, f, LV["lastdrop"], -0.05, {"drop": -3, "kitchen": -12})
    nn = idx(2.6)
    tt = np.arange(nn) / SR
    bloom = osc(glide(62, 52, nn, 0.4), nn) * env_ad(nn, 0.03, 0.7, 0.4)
    add(mx, "hit_dropbloom", norm(bloom), f, LV["lastdrop"] - 13, 0.0)
    # the carton slides out of frame (pushed right)
    a, b = F_CARTON
    d = fsec(b - a)
    c = carton_slide(rng, d)
    add(mx, "fx_carton", pan_st(c, keys([(0, 0.15), (d, 0.85)], len(c))), a, LV["carton"], 0.0, {"kitchen": -8})
    # 'ever again': a small nervous swallow (a little water still in his mouth)
    add(mx, "voc_swallow", gulp(rng, 1.1, 0.12), F_SWALLOW2, LV["swallow"], 0.0, {"kitchen": -14})


def build_clock(mx):
    """The wall clock: tick/tock on CLOCK_SEGS (faster every day), softer under the heart scenes,
    three last faint slowing ticks in S16."""
    rng = R(3)
    k = 0
    for (a, b, per, lo) in CLOCK_SEGS:
        f = a  # (first tick, stop, period, level)
        while f < b:
            dip = sum(dd for (x0, x1, dd) in CLOCK_DIP if x0 <= f < x1)
            first = f == F_CLOCK_START
            lvl = LV["clock"] + lo + dip + (2.0 if first else 0.0) - 0.8 * (k % 2)
            pan = 0.35 if f < 260 else 0.2
            sends = {"kitchen": -8} if f < 260 else ({"bath": -10} if 1087 <= f < 1187 else {"room": -12})
            add(mx, "tick_clock", clock_tick(rng, k % 2 == 1), f, lvl, pan, sends)
            f += per
            k += 1
    for j, f in enumerate(CLOCK_S16):
        add(mx, "tick_clock", lp(clock_tick(rng, j % 2 == 1, 0.6), 5000, 2), f, LV["clock"] - 9 - 2.5 * j, 0.3, {"room": -8})


def build_days(mx):
    """Each clock wipe: tick-tick at its start, a circular whoosh following the hand, then on the stamp
    frame (EV.stamps) a deep D bell + a stamp thud -- heavier every day."""
    rng = R(4)
    for j, (w0, fs) in enumerate(F_WIPES):
        for k, off in enumerate((0, 4)):
            add(mx, "tick_wipe", clock_tick(rng, k == 1, 1.2), w0 + off, LV["wipetick"] + (1.5 if k else 0), -0.2 + 0.4 * k)
        d = fsec(fs - w0) + 0.25
        add(mx, "tr_wipe", wipe_whoosh(rng, d), w0 + 1, LV["wipe"] + 0.5 * j, 0.0, {"air": -8})
        bl = day_bell(rng, 146.83, 3.6 + 0.4 * j, 0.7 + 0.1 * j)
        add(mx, "hit_bell", bl, fs, LV["bell"] + 0.5 * j, 0.0, {"big": -14})
        nn = idx(2.4)
        th = thud(rng, 88 - 4 * j, 40 - 2 * j, 0.14 + 0.03 * j, 2.4, 0.7, 240)
        slap = bp(white(nn, rng), 600, 3000, 2) * env_ad(nn, 0.0004, 0.014)
        add(mx, "hit_stamp", norm(0.9 * th + 0.3 * norm(slap)), fs, LV["stamp"] + 0.8 * j, 0.0, {"big": -12})


def build_body_beds(mx):
    """The x-ray medical bed under S03-S06, S13-S15, S19."""
    rng = R(5)
    shapes = {
        F_MED[0]: [(242, -79), (250, -6), (262, 0), (488, 0), (498, -3), (626, -3), (642, -5), (735, -6), (753, -79)],
        F_MED[1]: [(1319, -79), (1330, -4), (1428, -3), (1535, -4), (1600, -6), (1646, -12), (1658, -79)],
        F_MED[2]: [(1982, -79), (1990, 0), (2118, 0), (2134, -79)],
    }
    for (f0, f1) in F_MED:
        n = seg_n(f0, f1)
        br = lin_f([(f0, 0.8), (f1, 0.9)], f0, f1) if f0 != 1319 else lin_f([(1319, 0.5), (1658, 0.2)], f0, f1)
        y = med_bed(rng, n, br)
        add(mx, "amb_med", y * db_f(shapes[(f0, f1)], f0, f1)[:, None], f0,
            LV["med19"] if f0 > 1900 else LV["med"])


def build_s03(mx):
    rng = R(6)
    # the water rising from the feet to 60 %: a bubbly rising pour (cavity resonance rises as it fills),
    # bubbles getting higher, a slosh + overshoot settle at the end
    a, b = F_FILL
    d = fsec(b - a) + 0.6
    n = idx(d)
    t = np.arange(n) / SR
    T = fsec(b - a)
    fc = np.exp(keys([(0, math.log(260)), (T * 0.85, math.log(1500)), (T, math.log(1350)), (d, math.log(1250))], n))
    pour = tv_filter(white(n, rng, 2), fc, "bp", 3.0, block=64)
    pour = rmsnorm(pour) * keys([(0, 0), (0.25, 0.8), (T * 0.85, 1.0), (T, 0.5), (d, 0)], n)[:, None]
    bub = np.zeros((n, 2))
    for p in np.nonzero(rng.random(n) < 22 / SR)[0]:
        if p > idx(T + 0.2):
            continue
        u = p / idx(T)
        bb = bubble(rng, rng.uniform(400, 900) * (1 + 1.4 * u), None, 0.4)
        e = min(n, p + len(bb))
        bub[p:e] += pan_st(bb[: e - p] * rng.uniform(0.3, 1.0), rng.uniform(-0.5, 0.5))
    y = pour + 0.9 * rmsn_soft(bub, 5)
    # the settle: two slosh swells (overshoot) at the 60 % line
    for k2, (at, amp) in enumerate(((T - 0.17, 1.0), (T + 0.25, 0.5))):
        sl = whoosh(rng, 0.5, 400, 1300, 1.2, 0.35, 0.2)
        mixin(y, pan_st(sl * amp * 0.6, 0.3 - 0.6 * k2), at)
    add(mx, "fx_fill", y / np.max(np.abs(y)), a, LV["fill"], 0.0, {"micro": -6})
    # tiny leaks seeping out: soft vapour hisses + micro drips
    a, b = F_LEAKS
    for j, f in enumerate(np.linspace(a, b - 4, 6)):
        nn = idx(0.3)
        hs = hp(white(nn, rng), 2500, 2) * bell(nn, 0.3, 1.0, 1.6)
        add(mx, "tex_leak", norm(hs), f, LV["leak"] - rng.uniform(0, 4), rng.uniform(-0.7, 0.7), {"micro": -6})
        if j % 2:
            add(mx, "tex_leak", plip(rng, rng.uniform(2200, 3200), 0.008, 0.5, d=0.15), f + 3, LV["leak"] + 2,
                rng.uniform(-0.6, 0.6), {"micro": -4})


def build_s04(mx):
    rng = R(7)
    for j, f in enumerate(F_EXHALES):  # vapour puffs from the mouth
        y = lp(breath(rng, 0.7, False, 600, 1300, 0.6, peak=0.25), 4500, 2)
        vap = hp(white(len(y), rng), 3500, 2) * bell(len(y), 0.3, 1.0, 1.8)
        add(mx, "voc_exhale", norm(norm(y) + 0.3 * norm(vap)), f, LV["exhale"] - 2 * j, 0.0, {"micro": -6})
    # the sweat bead: forms (tiny swell), trickles (descending micro plips), drops at the end
    a, b = F_SWEAT
    d = fsec(b - a)
    nn = idx(d + 0.4)
    y = np.zeros(nn)
    t_form = fsec(F_TRICKLE - a)
    nf = idx(t_form)
    y[:nf] += 0.3 * norm(osc(np.exp(np.linspace(math.log(1800), math.log(2400), nf)), nf) * bell(nf, 0.8, 1.5, 1.0))
    k = 0
    tt = t_form
    while tt < d - 0.05:
        f = 2600 - 1200 * (tt - t_form) / (d - t_form)
        mixin(y, rng.uniform(0.25, 0.55) * bubble(rng, f * rng.uniform(0.9, 1.1), 0.006, 0.3), tt)
        tt += rng.uniform(0.04, 0.09)
        k += 1
    mixin(y, 0.9 * plip(rng, 1500, 0.02, 0.6, crown=2, d=0.4), d)
    y += 0.25 * norm(bp(white(nn, rng), 1500, 5000, 2) * bell(nn, 0.5, 1.2, 1.2))
    add(mx, "fx_sweat", norm(y), a, LV["sweat"], 0.35, {"micro": -5})
    for j, f in enumerate(F_BLADDER):  # schematic drips from the glowing bladder
        add(mx, "fx_bladder", plip(rng, 900 + 60 * j, 0.03, 0.5, crown=1, d=0.5), f, LV["bladder"] - 3 * j, -0.1,
            {"micro": -5})


def build_s05(mx):
    rng = R(8)
    # 'A few hours in': a fluttering time-lapse swell (flutter accelerating)
    a, b = F_TIMELAPSE
    d = fsec(b - a) + 0.4
    n = idx(d)
    tt = np.arange(n) / SR
    rate = np.exp(np.linspace(math.log(3.0), math.log(14), n))
    flut = 0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(rate) / SR)
    fc = np.exp(keys([(0, math.log(500)), (d * 0.7, math.log(2800)), (d, math.log(1500))], n))
    sw = tv_filter(white(n, rng, 2), fc, "bp", 1.3, block=64) * flut[:, None]
    sw = rmsnorm(sw) * bell(n, 0.7, 1.6, 1.2)[:, None]
    sh = sum(osc(fq * (1 + 0.03 * np.sin(2 * np.pi * 0.9 * tt)), n, rng.random() * 6) for fq in (2093, 3136, 4186))
    sw += 0.25 * np.stack([sh, sh], 1) / np.max(np.abs(sh)) * bell(n, 0.6, 1.3, 1.3)[:, None]
    add(mx, "tr_timelapse", sw / np.max(np.abs(sw)), a, LV["timelapse"], 0.0, {"micro": -4})
    # salt cubes crowding in: a crystal tinkle cluster peaking at 'saltier'
    a, b = F_SALT
    for j in range(16):
        u = rng.random() ** 0.8
        f = a + u * (b - a)
        lvl = LV["salt"] - 10 * abs(f - MK["saltier"]) / (b - a) - rng.uniform(0, 3)
        add(mx, "tick_salt", glass_tick(rng.uniform(3800, 7600), rng, rng.uniform(0.25, 0.5), 0.6, dur=0.25), f, lvl,
            rng.uniform(-0.75, 0.75), {"micro": -4})
    # the hypothalamus highlights: a soft glassy ping
    add(mx, "ui_hypo", glass_tick(1760, rng, 1.4, 0.4, dur=0.9), F_HYPO, LV["hypo"], -0.1, {"micro": -3})
    # THE ALARM on EV.alarms (the one in the VO pause strongest; the one on 'Thirst' leaner, under the word)
    for j, f in enumerate(EV["alarms"]):
        last = j == len(EV["alarms"]) - 1
        y = alarm_whoop(rng, 0.55 if last else 1.0, 0.7 if last else 0.4, 0.6 if last else 0.5)
        lvl = LV["alarm"] + (-3.0 if j == 0 else (0.0 if j == 1 else -4.5))
        add(mx, "ui_alarm", y, f, lvl, 0.0, {"micro": -5})
    # ADH capsules released by the pituitary, falling: soft violet descending blips
    for j, f in enumerate(F_ZAPS):  # nerve sparks hitting the mouth/throat
        nn = idx(0.18)
        zz = hp(crackle(nn, 9000, rng, 0.00015), 2500, 2) * env_ad(nn, 0.001, 0.04)
        z2 = osc(glide(3200, 1400, nn, 0.02), nn) * env_ad(nn, 0.001, 0.03)
        add(mx, "tick_zap", norm(norm(zz) + 0.4 * norm(z2)), f, LV["alarm"] - 9 - j, 0.35, {"micro": -4})
    a, b = F_ADH  # capsules pop out ~every 2.4 f
    for j, f in enumerate(np.arange(a, b - 2, 2.4)):
        y = tone_blip(880 - 15 * j, 620 - 15 * j, 0.03, 0.18, rng, 0.25, glide_tau=0.03)
        add(mx, "tick_adh", norm(y), f, LV["adh"] - 0.25 * j - 2 * (j % 2), 0.3 * math.sin(j * 1.9), {"micro": -4})


def build_s06(mx):
    rng = R(9)
    f0, f1 = F_KFLOW
    n = seg_n(f0, f1)
    y = organic_flow(rng, n, 1.0, 0.0)
    g = db_f([(f0, -79), (634, -4), (645, 0), (700, 0), (720, -2), (740, -6), (f1, -79)], f0, f1)
    add(mx, "body_kflow", y * g[:, None], f0, LV["kflow"])
    for j, f in enumerate(np.arange(F_ADH_DOCK[0], F_ADH_DOCK[1], 1.7)):  # 12 ADH docking clicks + thups
        k = norm(tone_blip(520 + 10 * j, 380, 0.02, 0.15, rng, 0.3)) + 0.5 * norm(bp(click(idx(0.15), 0, 0.0004), 1500, 6000, 2))
        add(mx, "tick_dock", norm(k), f, LV["dock"] - 2 - 3 * (j % 2) - 0.2 * j, 0.5 * math.sin(j * 2.1), {"micro": -4})
    for j, f in enumerate(F_VALVES):  # the aquaporin gates: little valve clicks + a soft suck (water pulled back)
        clk = bp(click(idx(0.12), 0, 0.0003), 1800, 6000, 2)
        nn = idx(0.12)
        suck = osc(glide(380, 640, nn, 0.03), nn) * env_ad(nn, 0.005, 0.03)
        y = norm(clk) + 0.45 * norm(suck)
        add(mx, "tick_valve", norm(y), f, LV["valves"] - rng.uniform(0, 4), rng.uniform(-0.6, 0.6), {"micro": -4})
    a, b = F_CHART  # the urine chart marker slides down: a soft descending glide
    d = fsec(b - a)
    nn = idx(d)
    gl = osc(np.exp(np.linspace(math.log(1200), math.log(700), nn)), nn) * bell(nn, 0.5, 1.2, 1.2)
    gl += 0.3 * bp(white(nn, rng), 1500, 5000, 2) * bell(nn, 0.5, 1.2, 1.2)
    add(mx, "ui_chart", norm(gl), a, LV["chart"], 0.45)
    # 'dark': a low dark tone (muted low tones + a soft thud)
    nn = idx(2.0)
    tt = np.arange(nn) / SR
    dk = (osc(73.4, nn) + 0.5 * osc(110.0, nn, 1) + 0.3 * osc(146.8 * 1.004, nn, 2)) * env_ad(nn, 0.02, 0.6, 0.4)
    dk = lp(dk, 600, 2) + 0.4 * thud(rng, 80, 50, 0.12, 2.0, 0.4, 200)
    add(mx, "hit_dark", norm(dk), F_DARK, LV["dark"], 0.0, {"body": -8})


def build_s07(mx):
    rng = R(10)
    f0, f1 = F_OFFICE
    n = seg_n(f0, f1)
    t = np.arange(n) / SR
    bed = room_bed(rng, n, 650) + 0.3 * rmsnorm(bp(pink(n, rng, 2), 400, 2200, 2)) * smooth_rand(n, 0.1, rng, 0.4, 0.9)[:, None]
    bed += 0.4 * lp(city(rng, n), 320, 2)
    g = db_f([(f0, -79), (744, -4), (752, 0), (870, 0), (f1, -79)], f0, f1)
    add(mx, "amb_office", bed * g[:, None], f0, LV["office"])
    a, b = F_TYPING  # sluggish key taps
    tt = fsec(a)
    while tt < fsec(b):
        nk = idx(0.06)
        kc = bp(click(nk, 0.0, 0.0004), 1500, 5000, 2) + 0.6 * lp(click(nk, 0.0, 0.0012), 450, 2)
        mx.add("fx_typing", norm(kc), tt, LV["typing"] - rng.uniform(0, 4), 0.25, {"room": -8})
        tt += rng.uniform(0.12, 0.26)
    add(mx, "voc_dry", dry_swallow(rng), F_DRY_SWALLOW - 0.14 * FPS, LV["dryswallow"], 0.0, {"room": -12})
    for j, f in enumerate(EV["throbs"]):  # headache: low muffled throbs, each a bit heavier
        add(mx, "hit_throb", throb(rng, 0.6), f - 0.5, LV["throb"] + 0.6 * j, 0.0, {"body": -8})
    # 'can't think straight': the blur warble (a wobbly detuned shimmer + a wah'd low swirl; mids kept clear)
    a, b = F_WARBLE
    d = fsec(b - a)
    n = idx(d)
    t = np.arange(n) / SR
    lfo = np.sin(2 * np.pi * np.cumsum(np.interp(t, [0, d], [3, 7])) / SR)
    sh = osc(2349 * (1 + 0.02 * lfo), n) + osc(2349 * 1.013 * (1 - 0.02 * lfo), n, 1) + 0.5 * osc(3136 * (1 + 0.025 * lfo), n, 2)
    lo_ = osc(110 * (1 + 0.03 * lfo), n) + osc(110 * 1.02, n, 1)
    wah = tv_filter(white(n, rng), 600 + 400 * lfo, "bp", 2.0, block=64)
    y = 0.5 * norm(sh) + 0.6 * norm(lo_) + 0.5 * norm(wah)
    pk = fsec(850 - a) / d
    y = y * bell(n, pk, 1.0, 1.5)
    add(mx, "tex_warble", pan_st(norm(y), 0.3 * lfo), a, LV["warble"], 0.0, {"room": -6})


def beat_env(f0, f1, beats, tau=0.25):
    """0..1 surge after each heartbeat (list of frames) on the local segment f0..f1."""
    n = seg_n(f0, f1)
    e = np.zeros(n)
    for f in beats:
        s = idx(fsec(f) - fsec(f0))
        if s >= n:
            continue
        ee = env_ad(n - s, 0.05, tau, 0.0)
        ss = max(0, s)
        e[ss:] += ee[ss - s:]
    return np.clip(e, 0, 1.5)


def build_s08(mx):
    rng = R(11)
    f0, f1 = F_FLOW8
    beats = [b for b in EV["beats"] if f0 - 30 <= b < f1]
    n = seg_n(f0, f1)
    he = beat_env(f0, f1, beats, 0.24)
    thick = lin_f([(f0, 0), (F_THICKEN[0], 0), (F_THICKEN[1], 1), (f1, 1)], f0, f1)
    fc = 300 * (1 - 0.4 * thick) * (1 + 0.3 * smooth_rand(n, 1.5, rng, -1, 1))
    st = tv_filter(white(n, rng, 2), fc, "bp", 0.9, block=128)
    flow = rmsnorm(st) * (0.5 + 0.6 * he)[:, None] + 0.9 * rmsnorm(lp(brown(n, rng, 2), 160, 2)) * (0.6 + 0.5 * he)[:, None]
    g = db_f([(f0, -79), (878, -3), (886, 0), (966, 0), (978, -6), (f1, -79)], f0, f1)
    add(mx, "body_flow", flow * g[:, None], f0, LV["flow"])
    # the thickening: a slow viscous low creak
    a, b = F_THICKEN
    c = creak(rng, fsec(b - a), 150, 6, 18, f_end=110, peak=0.5)
    add(mx, "fx_thick", lp(c, 900, 2), a, LV["thick"], 0.1, {"body": -6})
    # heartbeats on EV.beats (S08 part): louder + tighter as they accelerate; the one under the stamp softer
    s8 = [b for b in EV["beats"] if 860 <= b < 990]
    for j, f in enumerate(s8):
        nxt = s8[j + 1] - f if j + 1 < len(s8) else 15
        dub = float(np.clip(fsec(nxt) * 0.33, 0.13, 0.22))
        lvl = LV["heartb"] - 4 + 4 * j / max(1, len(s8) - 1) - (6 if f >= 976 else 0)
        add(mx, "heart", heartbeat(rng, 250, 1.7, dub=dub), f, lvl, 0.0, {"body": -8})


def build_s09(mx):
    rng = R(12)
    f0, f1 = F_TISSUE
    n = seg_n(f0, f1)
    y = organic_flow(rng, n, 0.6, 0.3) * 0.7 + 0.6 * med_bed(rng, n, np.full(n, 0.5))
    g = db_f([(f0, -79), (975, -3), (986, 0), (1088, 0), (f1, -79)], f0, f1)
    add(mx, "amb_tissue", y * g[:, None], f0, LV["tissue"])
    # osmosis: water streaming out of the cells into the capillary -- fine fizz + tiny bubbles moving
    a, b = F_OSMOSIS
    d = fsec(b - a)
    n = idx(d)
    fz = np.stack([hp(crackle(n, 3500, rng, 0.00018), 2500, 2) for _ in range(2)], 1)
    fz = rmsn_soft(fz) * bell(n, 0.45, 1.3, 1.4)[:, None]
    bub = np.zeros((n, 2))
    for p in np.nonzero(rng.random(n) < 14 / SR)[0]:
        bb = bubble(rng, rng.uniform(1600, 3200), 0.006, 0.5)
        e = min(n, p + len(bb))
        bub[p:e] += pan_st(bb[: e - p] * rng.uniform(0.3, 1.0), np.clip(0.8 * (p / n) - 0.4 + rng.normal(0, 0.2), -0.9, 0.9))
    y = fz + 0.8 * rmsn_soft(bub, 5) * bell(n, 0.45, 1.3, 1.4)[:, None]
    add(mx, "tex_fizz", y / np.max(np.abs(y)), a, LV["fizz"], 0.0, {"micro": -5})
    # the cells crinkle as they shrivel (soft papery crumple), staggered: a main one + two smaller
    a, b = F_CRINKLE
    pk = fsec(MK["shrivel"] - a) / fsec(b - a)
    add(mx, "fx_crinkle", crinkle(rng, fsec(b - a), pk), a, LV["crinkle"], 0.0, {"micro": -5})
    for j, (off, pan) in enumerate(((6, -0.6), (12, 0.6))):
        add(mx, "fx_crinkle", crinkle(rng, 0.6, 0.3), a + off, LV["crinkle"] - 6 - 2 * j, pan, {"micro": -5})


def build_s10(mx):
    rng = R(13)
    f0, f1 = F_BATH
    n = seg_n(f0, f1)
    t = np.arange(n) / SR
    bed = room_bed(rng, n, 1500)
    flick = 0.85 + 0.15 * smooth_rand(n, 3.0, rng, 0, 1)
    buzz = bp(saw_blep(100.0, n), 100, 3000, 2) + 0.5 * osc(100.0, n)
    fl = rmsnorm(np.stack([buzz, buzz * 0.95], 1)) * flick[:, None]
    g = db_f([(f0, -79), (1096, -3), (1104, 0), (1172, 0), (f1, -79)], f0, f1)
    add(mx, "amb_bath", bed * g[:, None], f0, LV["bath"], 0.0, {"bath": -12})
    add(mx, "amb_fluoro", fl * g[:, None], f0, LV["fluoro"])
    # the pinch: a soft skin grab, then the release on 'bounce' (dry tick) + the fold sinking back slowly
    nn = idx(0.15)
    grab = bp(white(nn, rng), 1200, 5000, 2) * env_ad(nn, 0.002, 0.02) + 0.5 * lp(click(nn, 0, 0.001), 600, 2)
    add(mx, "fx_pinch", norm(grab), F_PINCH, LV["pinch"] - 4, 0.3, {"bath": -8})
    nn = idx(1.4)
    tk = bp(click(nn, 0, 0.0004), 1500, 6000, 2) + 0.4 * lp(click(nn, 0, 0.0012), 500, 2)
    slow = lp(creak(rng, 1.3, 260, 6, 12, f_end=200, peak=0.3), 1200, 2)
    y = mixin(norm(tk), 0.25 * slow, 0.0)
    add(mx, "fx_pinch", norm(y), F_PINCH_RELEASE, LV["pinch"], 0.3, {"bath": -8})
    # 'Your eyes sink': a soft low sinking tone
    nn = idx(1.4)
    sk = osc(np.exp(np.linspace(math.log(196), math.log(130), nn)), nn) + 0.4 * osc(np.exp(np.linspace(math.log(294), math.log(196), nn)), nn, 1)
    sk *= env_ad(nn, 0.05, 0.4, 0.3)
    add(mx, "fx_sink", norm(lp(sk, 800, 2)), F_EYES_SINK - 1, LV["sink"], 0.0, {"bath": -6})


def cicadas(rng, n, rate_env):
    """Cicada chorus: high noise bands pulsed at ~40-60 Hz in swelling phrases, 3 bugs across the field."""
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, (fc, pr, pan) in enumerate(((4700, 47, -0.6), (5600, 55, 0.5), (4100, 41, 0.05))):
        car = bp(white(n, rng), fc * 0.85, fc * 1.18, 2)
        am = (0.5 + 0.5 * np.sin(2 * np.pi * pr * t + rng.random() * 6)) ** 4
        ph = smooth_rand(n, rng.uniform(0.25, 0.45), rng, 0, 1) ** 1.5
        out += pan_st(rmsnorm(car * am) * ph * rate_env, pan)
    return out


def build_s11(mx):
    rng = R(14)
    f0, f1 = F_STREET
    n = seg_n(f0, f1)
    t = np.arange(n) / SR
    g = db_f([(f0, -79), (1180, -3), (1188, 0), (1252, 0), (1259, 1), (f1, -79)], f0, f1)
    heat = lin_f([(f0, 0.3), (1220, 0.5), (1259, 1.0), (f1, 1.0)], f0, f1)
    add(mx, "amb_street", city(rng, n) * g[:, None], f0, LV["traffic"])
    add(mx, "amb_street", rmsnorm(lp(pink(n, rng, 2), 2500, 2)) * g[:, None], f0, LV["street"])
    add(mx, "bird_cicada", rmsnorm(cicadas(rng, n, 0.7 + 0.3 * heat)) * g[:, None], f0, LV["cicada"])
    # the heat-shimmer drone rising to 1259: a low drone climbing + a detuned high shimmer
    fr = 55 * 2 ** (4 * heat / 12)
    dr = osc(fr, n) + 0.5 * osc(fr * 1.5, n, 1) + 0.3 * osc(fr * 2.01, n, 2)
    shm = sum(osc(f * (1 + 0.006 * np.sin(2 * np.pi * (3 + i) * t + i)), n, i) for i, f in enumerate((2637, 2794, 3520)))
    y = rmsnorm(np.stack([dr, dr], 1)) * 0.8 + 0.35 * rmsnorm(pan_st(shm, 0.3 * np.sin(2 * np.pi * 0.4 * t)))
    y *= (heat ** 1.5)[:, None]
    add(mx, "tex_heat", y * g[:, None], f0, LV["heatdrone"])
    # a car passing behind him
    w = whoosh(rng, 1.6, 180, 900, 0.8, 0.5, 0.8)
    add(mx, "far_car", pan_st(lp(w, 2500, 2), keys([(0, -0.8), (1.6, 0.8)], len(w))), F_CAR_PASS, LV["carpass"])
    for j, f in enumerate(F_STEPS):  # slow heavy footfalls on hot asphalt
        nn = idx(0.25)
        heel = osc(glide(105, 65, nn, 0.012), nn) * env_ad(nn, 0.002, 0.035)
        scuff = bp(white(nn, rng), 700, 4000, 2) * env_at(nn, 0.01, 0.01, 0.07)
        add(mx, "fx_step", norm(0.7 * norm(heel) + norm(scuff)), f, LV["sofa"] - 6 - (j % 2), 0.1 * (-1) ** j, {"room": -14})
    add(mx, "ui_thermo", norm(tone_blip(700, 1050, 0.03, 0.2, rng, 0.2, glide_tau=0.02)), F_THERMO[0], LV["thermo"] + 4, 0.4)
    # the thermometer tag rising
    a, b = F_THERMO
    d = fsec(b - a)
    nn = idx(d)
    tt = np.arange(nn) / SR
    th = osc(np.exp(np.linspace(math.log(880), math.log(1320), nn)), nn) * (0.7 + 0.3 * np.sin(2 * np.pi * 12 * tt))
    add(mx, "ui_thermo", norm(th * bell(nn, 0.8, 1.2, 1.0)), a, LV["thermo"], 0.4)


def build_s12(mx):
    rng = R(15)
    f0, f1 = F_LIVING
    n = seg_n(f0, f1)
    bed = room_bed(rng, n, 700)
    g = db_f([(f0, -79), (1259, -3), (1268, 0), (1320, 0), (f1, -79)], f0, f1)
    add(mx, "amb_living", bed * g[:, None], f0, LV["living"], 0.0, {"room": -10})
    # standing up from the sofa: the frame creaks + the cushion releases
    a, b = F_SOFA
    d = fsec(b - a)
    c = creak(rng, d, 190, 14, 40, f_end=260, peak=0.35)
    nn = idx(d)
    cu = lp(bp(white(nn, rng), 150, 1200, 2), 900, 2) * bell(nn, 0.25, 1.0, 1.8)
    add(mx, "fx_sofa", norm(lp(c, 2200, 2) + 0.5 * norm(cu)), a, LV["sofa"], 0.25, {"room": -6})
    # his hand grips the bookcase: a wooden thud + a short rattle of things on the shelf
    a, b = F_GRIP
    add(mx, "fx_grip", thud(rng, 130, 80, 0.05, 0.5, 0.9, 380), a, LV["sofa"] - 2, -0.4, {"room": -6})
    for j in range(6):
        add(mx, "fx_grip", glass_tick(rng.uniform(1800, 3600), rng, 0.25, 0.4, dur=0.15), a + 1 + j * (b - a - 1) / 6,
            LV["sofa"] - 12 - j, -0.45 + 0.1 * j, {"room": -6})
    # the room spins: a swirling, pitch-bending whoosh circling the stereo field
    a, b = F_SWIRL
    d = fsec(b - a) + 0.3
    n = idx(d)
    t = np.arange(n) / SR
    rot = 2 * np.pi * np.cumsum(np.interp(t, [0, d * 0.5, d], [0.5, 0.9, 0.6])) / SR
    fc = 900 * (1 + 0.6 * np.sin(rot * 2))
    sw = tv_filter(white(n, rng), fc, "bp", 2.2, block=64)
    bend = 1 + 0.06 * np.sin(rot) + 0.03 * np.sin(rot * 2.7)
    tones = osc(196 * bend, n) + osc(196 * 1.008 / bend, n, 1) + 0.4 * osc(2349 * bend, n, 2)
    y = norm(sw) + 0.45 * norm(tones)
    y *= bell(n, 0.45, 1.3, 1.5)
    add(mx, "tex_swirl", pan_st(norm(y), 0.85 * np.sin(rot)), a, LV["swirl"], 0.0, {"room": -8})


def build_s13(mx):
    rng = R(16)
    f0, f1 = F_BRAIN
    n = seg_n(f0, f1)
    fog = lin_f([(f0, 0), (1370, 0), (1395, 1), (f1, 1)], f0, f1)
    y = organic_flow(rng, n, 0.5, 0.2) * 0.5
    sp = np.stack([hp(crackle(n, 120, rng, 0.0003), 2500, 2) for _ in range(2)], 1)
    y = y + 0.25 * rmsn_soft(sp, 4)
    cut = 6000 * 2 ** (-3.5 * fog)
    y = tv_filter(y, cut, "lp", [0.5412, 1.3066], block=128)
    g = db_f([(f0, -79), (1326, -3), (1334, 0), (1410, 0), (f1, -79)], f0, f1)
    add(mx, "amb_brain", rmsnorm(y) * g[:, None], f0, LV["brain"])
    # the shrink groan: a low creaky groan sliding down + a soft inward squeeze
    a, b = F_GROAN
    d = fsec(b - a)
    nn = idx(d + 0.3)
    tt = np.arange(nn) / SR
    fr = np.exp(np.linspace(math.log(62), math.log(44), nn)) * (1 + 0.01 * np.sin(2 * np.pi * 6 * tt))
    gr = lp(saw_blep(fr, nn), 420, 2) * (0.7 + 0.3 * smooth_rand(nn, 12, rng, 0, 1))
    c = creak(rng, d, 120, 8, 20, f_end=90, peak=0.4)
    sq = whoosh(rng, d, 1400, 400, 1.0, 0.3, 0.3)
    y = norm(gr * bell(nn, 0.3, 1.2, 1.5))
    mixin(y, 0.4 * lp(c, 900, 2), 0.0)
    mixin(y, 0.3 * sq, 0.0)
    add(mx, "fx_groan", norm(y), a, LV["groan"], 0.0, {"body": -6})
    # sputtering neural sparks: bursts that stall and misfire, getting sparser and duller
    a, b = F_SPUTTER
    tt = fsec(a)
    k = 0
    while tt < fsec(b):
        u = (tt - fsec(a)) / fsec(b - a)
        nn = idx(rng.uniform(0.04, 0.12))
        zz = hp(crackle(nn, 9000 * (1 - 0.6 * u), rng, 0.00015), 2000, 2) * bell(nn, 0.3, 1.0, 1.2)
        z2 = osc(glide(rng.uniform(1800, 3000), 900, nn, 0.02), nn) * env_ad(nn, 0.002, 0.02)
        y = lp(norm(zz) + 0.35 * norm(z2), 7000 - 4500 * u, 2)
        add(mx, "tex_sputter", norm(y), tt * FPS, LV["sputter"] - 6 * u - rng.uniform(0, 3), rng.uniform(-0.7, 0.7), {"micro": -4})
        tt += rng.uniform(0.07, 0.2) * (1 + 1.8 * u)
        k += 1
    # 'fog': a muffled fog whoosh
    w = lp(whoosh(rng, 1.4, 300, 900, 0.8, 0.4, 0.5, stereo=True), 1200, 2)
    add(mx, "tr_fog", w, F_FOG - 8, LV["fog"])


def build_s14(mx):
    rng = R(17)
    f0, f1 = F_KFLOW14
    n = seg_n(f0, f1)
    s = EV["shutdown"][0]
    y = organic_flow(rng, n, 0.55, 0.6)
    g = db_f([(f0, -79), (1419, -3), (1430, 0), (s - 2, 0), (s + 4, -7), (1530, -7), (f1, -79)], f0, f1)
    add(mx, "body_kflow14", y * g[:, None], f0, LV["kflow14"])
    for j, f in enumerate(F_KPULSES):  # weakening, laboured kidney pulses
        add(mx, "fx_kpulse", throb(rng, 0.5), f, LV["winddown"] + 2 - 2.5 * j, 0.0, {"body": -8})
    nn = idx(1.2)  # the NO URINE stamp: a dull muted thud + slap
    th = thud(rng, 110, 60, 0.08, 1.2, 0.6, 300)
    sl = bp(white(nn, rng), 600, 2500, 2) * env_ad(nn, 0.0005, 0.012)
    add(mx, "hit_nourine", norm(th + 0.3 * norm(sl)), F_NO_URINE, LV["stamp"] - 8, 0.2, {"room": -10})
    a, b = F_WINDDOWN
    d = fsec(b - a) + 0.6
    add(mx, "fx_winddown", wind_down(rng, d, fsec(b - a)), a, LV["winddown"], -0.1, {"body": -6})
    # thick gloopy bubbles (toxins building up): slow, low, viscous
    a, b = F_GLOOP
    tt = fsec(a)
    while tt < fsec(b):
        bb = bubble(rng, rng.uniform(140, 360), rng.uniform(0.04, 0.08), 0.35)
        nn = len(bb) + idx(0.05)
        y = np.zeros(nn)
        mixin(y, norm(bb), 0.0)
        y += 0.3 * norm(lp(white(nn, rng), 500, 2)) * env_ad(nn, 0.005, 0.03)
        add(mx, "fx_gloop", norm(lp(y, 1500, 2)), tt * FPS, LV["gloop"] - rng.uniform(0, 5), rng.uniform(-0.6, 0.6), {"body": -5})
        tt += rng.uniform(0.18, 0.42)


def build_s15(mx):
    rng = R(18)
    f0, f1 = F_CHEST
    n = seg_n(f0, f1)
    beats = [b for b in EV["beats"] if f0 - 30 <= b < f1]
    he = beat_env(f0, f1, beats, 0.2)
    y = rmsnorm(lp(brown(n, rng, 2), 150, 2)) * (0.6 + 0.6 * he)[:, None] + 0.5 * rmsnorm(bp(pink(n, rng, 2), 120, 600, 2))
    g = db_f([(f0, -79), (1535, -3), (1545, 0), (1630, 0), (1646, -10), (f1, -79)], f0, f1)
    add(mx, "body_chest", y * g[:, None], f0, LV["chest"])
    a, b = F_PFALL
    add(mx, "fx_pfall", pressure_fall(rng, fsec(b - a) + 0.4), a, LV["pfall"], 0.0, {"body": -6})
    # the racing heart (tight lub-dubs), then the stumble: 1619 + a double 1625, a gap, 1640 (heavier)
    s15 = [b for b in EV["beats"] if 1520 <= b < 1646]
    st = MK["stumbles"]
    for j, f in enumerate(s15):
        if f < st:
            add(mx, "heart", heartbeat(rng, 270, 1.8, dub=0.13), f, LV["heart15"] - 2 + 2 * j / 6, 0.0, {"body": -8})
        else:
            k = s15.index(f) - len([x for x in s15 if x < st])
            dub_amt = [0.3, 0.0, 0.7][k % 3]
            lvl = LV["heart15"] + [-1.0, -4.0, 0.5][k % 3]
            add(mx, "heart", heartbeat(rng, 230, 2.0, dub=0.16, dub_amt=dub_amt), f, lvl, 0.0, {"body": -6})


def build_s16(mx):
    rng = R(19)
    f0, f1 = F_BEDROOM
    n = seg_n(f0, f1)
    bed = room_bed(rng, n, 500)
    g = db_f([(f0, -79), (1646, -6), (1656, 0), (1700, -1), (1735, -4), (1758, -12), (f1 - 1, -60), (f1, -79)], f0, f1)
    add(mx, "amb_bedroom", bed * g[:, None], f0, LV["bedroom"])
    cur = lp(bp(pink(n, rng, 2), 250, 2500, 2), 2000, 2) * (smooth_rand(n, 0.35, rng, 0, 1) ** 2)[:, None]
    add(mx, "amb_curtain", rmsnorm(cur) * g[:, None], f0, LV["curtain"])
    # one far evening bird outside the window
    eb = bird_phrase(rng, "blackbird")
    add(mx, "far_bird", norm(lp(eb, 3800, 2)), F_EVE_BIRD, LV["birdeve"], 0.6, {"room": -4})
    # faint slow heartbeats on EV.beats (S16), fading
    s16 = [b for b in EV["beats"] if b >= 1650]
    for j, f in enumerate(s16):
        y = lp(heartbeat(rng, 180, 1.4, dub=0.26, dub_amt=0.45 - 0.1 * j), 220, 2)
        add(mx, "heart", norm(y), f, LV["heart16"] - 3.5 * j, 0.0, {"body": -6})
    # slow breaths while he drifts (very soft, low-passed), slowing
    for j, (fa, fb, fc) in enumerate(F_BREATHS16):
        bi = lp(breath(rng, fsec(fb - fa) + 0.05, True, 550, 1200, 0.3, peak=0.6), 1500, 2)
        add(mx, "voc_breath", bi, fa, LV["breath16"] - 2 * j, 0.0)
        if fc is not None:
            bo = lp(breath(rng, fsec(fc - fb), False, 480, 1000, 0.25, peak=0.25), 1300, 2)
            add(mx, "voc_breath", bo, fb, LV["breath16"] - 1 - 2 * j, 0.0)
    # the long last breath out, ending in stillness
    a, b = F_LAST_BREATH
    lb = lp(breath(rng, fsec(b - a), False, 470, 950, 0.25, peak=0.14), 1100, 2)
    lb *= keys([(0, 1.0), (fsec(b - a) * 0.6, 0.8), (fsec(b - a), 0.0)], len(lb))
    add(mx, "voc_lastbreath", norm(lb), a, LV["lastbreath"], 0.0)


def build_s17(mx):
    rng = R(20)
    f0, f1 = F_CAUSTIC
    n = seg_n(f0, f1)
    t = np.arange(n) / SR
    sh = np.zeros((n, 2))
    for f in (2349, 3136, 3520, 4699, 5274):
        a = smooth_rand(n, rng.uniform(0.15, 0.4), rng, 0, 1) ** 3
        sh += pan_st(osc(f, n, rng.random() * 6) * a, rng.uniform(-0.8, 0.8))
    air = bp(pink(n, rng, 2), 1500, 8000, 2)
    y = 0.6 * rmsnorm(sh) + rmsnorm(air)
    g = db_f([(f0, -79), (1790, -6), (1800, 0), (1884, 0), (f1, -79)], f0, f1)
    add(mx, "amb_caustic", y * g[:, None], f0, LV["caustic"], 0.0, {"drop": -14})
    for j, f in enumerate(F_HOURGLASS):  # the hourglass's last drops (soft)
        add(mx, "fx_hdrop", plip(rng, 1500 + 60 * (j % 4), 0.025, 0.6, crown=1, d=0.4), f, LV["hdrop"] - 3 * (j % 2) - 0.3 * j,
            0.15 * math.sin(j * 1.9),
            {"drop": -10})
    # 'three': the deep sub boom (a pre-suck, a sub drop, a dark bloom)
    f = F_SUB_BOOM
    add(mx, "hit_boompre", reverse_swell(rng, 0.35, 200, 1800), f - 0.35 * FPS, LV["subboom"] - 16, 0.0)
    nn = idx(3.5)
    tt = np.arange(nn) / SR
    boom = osc(glide(58, 33, nn, 0.35), nn) * env_ad(nn, 0.008, 0.7, 0.4)
    boom += 0.45 * osc(glide(116, 70, nn, 0.08), nn) * env_ad(nn, 0.004, 0.18)
    boom += 0.25 * lp(white(nn, rng), 220, 2) * env_ad(nn, 0.003, 0.25)
    boom = np.tanh(1.3 * norm(boom))
    add(mx, "hit_boom", np.stack([boom, boom], 1) / np.max(np.abs(boom)), f, LV["subboom"], 0.0, {"big": -10})
    # the very last drop
    add(mx, "hero_drop17", plip(rng, 1250, 0.04, 0.7, crown=6, sparkle=0.3, d=1.2), F_DROP17, LV["drop17"], 0.0,
        {"drop": -4})


def build_s18_static(mx):
    """S18 parts that don't need the rendered bed: the tape button, the motor whine, the HUD-clock ratchet,
    the stop clack, the flash. (The garble itself is made in main() from the rendered sound.)"""
    rng = R(21)
    # tape button 'ka-chunk'
    nn = idx(0.5)
    tt = np.arange(nn) / SR
    k1 = bp(click(nn, 0, 0.0006), 800, 5000, 2) + 0.7 * lp(click(nn, 0, 0.002), 400, 2)
    k2 = bp(click(nn, 0.045, 0.0008), 600, 4000, 2) + 0.9 * lp(click(nn, 0.045, 0.003), 300, 2)
    th = osc(glide(140, 80, nn, 0.02), nn) * env_at(nn, 0.045, 0.002, 0.04)
    add(mx, "fx_rwclunk", norm(norm(k1) + norm(k2) + 0.6 * norm(th)), F_RW_BUTTON, LV["rwclunk"], 0.0, {"room": -10})
    a, b = F_RW_RUN
    n = seg_n(a, b)
    t = np.arange(n) / SR
    sh = rewind_shape(n)
    # the motor 'wheee': pitch follows the tape speed
    fm = 160 + 980 * sh
    wh = osc(fm * (1 + 0.012 * np.sin(2 * np.pi * 9 * t)), n) + 0.35 * osc(fm * 2, n, 1) + 0.15 * osc(fm * 3, n, 2)
    wh = lp(wh, 4000, 2) * sh
    add(mx, "rw_whine", pan_st(norm(wh), 0.15 * np.sin(2 * np.pi * 1.3 * t)), a, LV["rwwhine"])
    # the HUD clock spinning back: a fast ratchet following the speed
    rate = 6 + 34 * sh
    ph = np.cumsum(rate) / SR
    ticks = np.nonzero(np.diff(np.floor(ph), prepend=0))[0]
    rr = np.zeros((n, 2))
    for j, p in enumerate(ticks):
        c = clock_tick(rng, j % 2 == 1, 1.0)
        e = min(n, p + len(c))
        rr[p:e] += pan_st(c[: e - p] * (0.5 + 0.5 * sh[p]), -0.3)
    add(mx, "rw_ratchet", rr / (np.max(np.abs(rr)) + 1e-12), a, LV["rwratchet"])
    # stop clack as it lands
    nn = idx(0.4)
    ck = bp(click(nn, 0, 0.0006), 900, 6000, 2) + 0.8 * lp(click(nn, 0, 0.002), 350, 2)
    add(mx, "fx_rwclunk", norm(ck), F_RW_STOP, LV["rwclunk"] - 3, 0.0, {"room": -10})
    # the flash (mint-white): a bright reverse swell into a soft whoomp + an airy glass shimmer tail
    f = F_FLASH
    add(mx, "hit_flash", reverse_swell(rng, 0.3, 900, 7000), f - 0.3 * FPS, LV["flash"] - 8, 0.0)
    nn = idx(2.2)
    tt = np.arange(nn) / SR
    wb = osc(glide(90, 45, nn, 0.08), nn) * env_ad(nn, 0.006, 0.28, 0.2)
    sh2 = hp(white(nn, rng), 3500, 2) * env_ad(nn, 0.004, 0.35, 0.2)
    gl = sum(osc(fq, nn, rng.random() * 6) for fq in (2349, 2960, 3520, 4699)) * env_ad(nn, 0.01, 0.6, 0.3)
    add(mx, "hit_flash", norm(norm(wb) + 0.4 * norm(sh2) + 0.2 * norm(gl)), f, LV["flash"], 0.0, {"air": -8})


def rw_map(n):
    """Source position (absolute frames, fractional) for every output sample of F_RW_RUN, following the
    picture's REWIND_SEGMENTS (each scene's local frames l0 -> l1 played backwards over [a, b)); before the
    first segment (the spin-up) it creeps back from the start of the first segment. Also returns the
    normalised tape speed (0..1) for the motor whine and the ratchet."""
    f0, f1 = F_RW_RUN
    n = seg_n(f0, f1)
    fo = f0 + np.arange(n) / SR * FPS
    src = np.empty(n)
    a0, _, st0, l0, _, _ = RW_SEGS[0]
    spin = fo < a0
    u = np.clip((fo[spin] - f0) / (a0 - f0), 0, 1)
    src[spin] = st0 + l0 + 6 * (1 - u) ** 2  # spin-up: a few frames creeping back into the first segment
    for (a, b, st, l0, l1, e) in RW_SEGS:
        m = (fo >= a) & (fo < b)
        u = np.clip((fo[m] - a) / max(1, b - a - 1), 0, 1)
        if e:
            u = 1 - (1 - u) ** 3
        src[m] = st + l0 + (l1 - l0) * u
    last = RW_SEGS[-1]
    m = fo >= last[1]
    src[m] = last[2] + last[4]
    sp = np.abs(np.gradient(src)) * SR / FPS  # source frames per output frame
    sp = uniform_filter1d_safe(sp, idx(0.03))
    return src, np.clip(sp / (np.max(sp) + 1e-9), 0.0, 1.0)


def uniform_filter1d_safe(x, w):
    from scipy.ndimage import uniform_filter1d
    return uniform_filter1d(x, max(1, w), mode="nearest")


def rewind_shape(n):
    return rw_map(n)[1]


def make_garble(bed: np.ndarray) -> np.ndarray:
    """The reel's own sound (sfx bed + narration + the score if rendered) replayed backwards exactly as the
    picture replays the scenes (RW_SEGS) -> pitchy tape chatter, as an (n,2) clip for F_RW_RUN."""
    f0, f1 = F_RW_RUN
    n = seg_n(f0, f1)
    L = idx(fsec(max(s_[2] + s_[3] for s_ in RW_SEGS) + 6))
    src = np.array(bed[:L], dtype=np.float32)
    src += np.float32(0.9) * load_vo_mono(L)[:, None]
    mp = PUB / "audio" / "music.wav"
    if mp.exists():
        import soundfile as sf
        m, _ = sf.read(str(mp), dtype="float32", always_2d=True, frames=L)
        src[: len(m)] += m[:, :2]
        del m
    filt_inplace(src, signal.butter(8, 1100, fs=SR, output="sos"))
    pos_f, sp = rw_map(n)
    pos = np.clip(pos_f / FPS * SR, 0, L - 1)
    grid = np.arange(L, dtype=np.float64)
    out = np.stack([np.interp(pos, grid, src[:, c]) for c in range(2)], 1)
    del src, grid
    out = lp(out, 9000, 2) * (0.2 + 0.8 * np.sqrt(sp))[:, None]
    out = np.tanh(1.5 * rmsnorm(out) / 3.0)
    rng = R(22)
    out += 0.08 * rmsnorm(hp(white(n, rng, 2), 3000, 2)) * sp[:, None]
    # a tiny tape-edit tick on every cut between replayed scenes
    for (a, b, *_r) in RW_SEGS[1:]:
        s0 = idx(fsec(a - f0))
        k = bp(click(idx(0.03), 0, 0.0004), 1500, 6000, 2)
        e = min(n, s0 + len(k))
        out[s0:e] += 0.25 * norm(k)[: e - s0, None]
    g = np.ones(n)
    gf = idx(fsec(F_FLASH - f0))
    g[gf:] = 0.0
    g[max(0, gf - idx(0.05)):gf] = np.cos(np.linspace(0, np.pi / 2, min(gf, idx(0.05)))) ** 2
    return fade_edges(out / np.max(np.abs(out)) * g[:, None], 0.02, 0.01)


def build_s19(mx):
    rng = R(23)
    # big gulps on EV.gulps; each pours down the throat and splashes into the body (pitch rising as it fills)
    for j, f in enumerate(EV["gulps"]):
        add(mx, "hero_gulp19", gulp(rng, 0.95, 1.3), f, LV["gulp19"] - 0.5 * j, 0.0, {"micro": -10})
    for j, f in enumerate(F_SPLASH19):  # the water splashes in, the level steps up (pitch rising as it fills)
        y = plip(rng, 700 + 120 * j, 0.03, 0.5, crown=4, d=0.6)
        nn = idx(0.6)
        sw = bp(white(nn, rng), 300, 2500, 2) * bell(nn, 0.15, 1.0, 1.8)
        sp = norm(y) + 0.5 * norm(sw)
        add(mx, "fx_splash", norm(sp), f, LV["splash"] - 0.5 * j, 0.15 * math.sin(j * 1.7), {"micro": -5})
    # the level rising: a soft bubbly fill (resonance up), like S03 but brighter
    a, b = F_FILL19
    d = fsec(b - a) + 0.5
    n = idx(d)
    T = fsec(b - a)
    fc = np.exp(keys([(0, math.log(300)), (T, math.log(1700)), (d, math.log(1600))], n))
    pour = tv_filter(white(n, rng, 2), fc, "bp", 3.0, block=64)
    pour = rmsnorm(pour) * keys([(0, 0), (0.3, 0.8), (T, 1.0), (d, 0)], n)[:, None]
    add(mx, "fx_fill19", pour / np.max(np.abs(pour)), a, LV["fill19"], 0.0, {"micro": -6})
    # shrivelled cells plumping back up: soft rising bloops
    for j, f in enumerate(F_PLUMP):
        y = tone_blip(420 + 40 * j, 760 + 60 * j, 0.05, 0.3, rng, 0.25, glide_tau=0.04)
        add(mx, "tick_plump", norm(y), f, LV["plump"] - 0.4 * j, [-0.5, 0.4, -0.2, 0.55, -0.4, 0.2][j % 6], {"micro": -4})
    # the mint refill shimmer
    a, b = F_SHIMMER19
    d = fsec(b - a)
    n = idx(d)
    sh = np.zeros((n, 2))
    for k, fq in enumerate((2349, 2960, 3520, 4434, 5274)):
        amp = smooth_rand(n, 3.0, rng, 0, 1) ** 2
        sh += pan_st(osc(fq, n, rng.random() * 6) * amp, -0.7 + 0.35 * k)
    sh *= keys([(0, 0), (d * 0.3, 0.7), (d * 0.7, 1.0), (d, 0)], n)[:, None]
    add(mx, "tex_shimmer", sh / np.max(np.abs(sh)), a, LV["shimmer"], 0.0, {"air": -6})


def build_s20(mx):
    rng = R(24)
    f0, f1 = F_KITCHEN20
    n = seg_n(f0, f1)
    bed = room_bed(rng, n, 1500, ((100, 1.0), (150.3, 0.5), (200.2, 0.35), (300.5, 0.15)), 0.35)
    g = db_f([(f0, -79), (2124, -4), (2134, 0), (f1, 0)], f0, f1)
    add(mx, "amb_kitchen20", bed * g[:, None], f0, LV["kitchen20"])
    birds = lp(bird_bed(rng, fsec(f1 - f0), 2.0, ("sparrow", "tit", "robin", "finch"), 0.85, 0.6), 8000, 2)
    add(mx, "bird_kitchen20", norm(birds) * g[:, None], f0, LV["bird20"], 0.0, {"kitchen": -10})
    add(mx, "hero_gulp20", gulp(rng, 1.0, 1.0), F_GULP20, LV["gulp"] - 3, 0.0, {"kitchen": -14})
    nn = idx(0.4)
    sl = bp(white(nn, rng), 300, 1500, 2) * bell(nn, 0.3, 1.0, 1.6)
    add(mx, "fx_slosh20", norm(sl), F_LOWER20, LV["ahh20"] - 6, 0.0, {"kitchen": -10})
    a, b = F_RAISE
    add(mx, "tr_raise", whoosh(rng, fsec(b - a) + 0.1, 400, 2000, 1.1, 0.8, 0.3), a, LV["whoosh"] - 3, 0.0, {"air": -10})
    for j, f in enumerate(F_WORDS):  # closing text words pop (tiny soft pops)
        add(mx, "ui_word", norm(tone_blip(650 + 90 * j, 1000 + 120 * j, 0.025, 0.15, rng, 0.2, glide_tau=0.015)), f,
            LV["textdrip"] - 4, 0.0, {"air": -8})
    # the contented 'ahh' (breathy, a hint of voice)
    nn = idx(0.9)
    tt = np.arange(nn) / SR
    br = breath(rng, 0.9, False, 750, 1250, 0.5, peak=0.18)
    v = saw_blep(glide(150, 118, nn, 0.4), nn)
    vo = (bpq(v, 750, 4.0) + 0.6 * bpq(v, 1200, 5.0) + 0.2 * bpq(v, 2600, 6.0)) * bell(nn, 0.18, 1.0, 2.2)
    add(mx, "voc_ahh20", norm(lp(norm(br) + 0.12 * norm(vo), 3500, 2)), F_AHH20, LV["ahh20"], 0.0, {"kitchen": -10})
    # the glass raised toward the camera: a bright clink
    nn = idx(1.5)
    tt = np.arange(nn) / SR
    ck = sum(a * np.exp(-t_ / tau) * np.sin(2 * np.pi * f * tt + rng.random() * 6)
             for f, a, tau, t_ in ((2489, 1.0, 0.5, tt), (5612, 0.4, 0.2, tt), (8130, 0.18, 0.08, tt), (3730, 0.25, 0.3, tt)))
    ck *= np.sin(np.clip(tt / 0.0004, 0, 1) * np.pi / 2) ** 2
    ck = norm(ck) + 0.3 * norm(hp(click(nn, 0, 0.0003), 3000, 2))
    add(mx, "hero_clink", norm(fade_edges(ck, 0, 0.3)), F_CLINK, LV["clink"], 0.0, {"kitchen": -8, "air": -14})
    add(mx, "tick_sparkle", sparkle_up(rng, 4700, 3, 0.04), F_CLINK + 3, LV["clink"] - 12, 0.2, {"air": -6})
    # the drip sliding off 'WATER.' lands
    for j, f in enumerate(F_TEXT_DRIP):
        add(mx, "fx_textdrip", plip(rng, 1600 - 80 * j, 0.025, 0.6, crown=2, sparkle=0.2, d=0.6), f, LV["textdrip"] - 1.5 * j,
            0.2, {"drop": -10})


def build_transitions(mx):
    """Soft editorial whooshes for the moving transitions; the x-ray ones get a scan."""
    rng = R(25)
    skip = {88}  # S01>S02: the glass-down covers it; the clock wipes are in build_days
    for tr in transitions():
        f, kind, dur = tr["frame"], tr["type"], tr["dur"]
        if f in skip or kind in ("fade", "flash", "dip", "clock"):
            continue
        d = fsec(dur) + 0.35
        if kind in ("xray", "xrayUp"):
            y = xray_scan(rng, d, kind == "xrayUp")
            add(mx, "tr_scan", np.stack([y, y], 1), f - dur / 2 - 4, LV["scan"], 0.0, {"air": -6})
            continue
        if kind == "zoomIn":
            w = whoosh(rng, d, 300, 2400, 1.0, 0.6, 0.4)
        elif kind == "zoomOut":
            w = whoosh(rng, d, 2200, 400, 1.0, 0.35, 0.4)
        elif kind == "whip":
            w = whoosh(rng, d * 0.8, 500, 4000, 1.4, 0.5, 0.2)
        elif kind == "slideUp":
            w = whoosh(rng, d, 1800, 500, 1.1, 0.45, 0.4)
        elif kind == "slideDown":
            w = whoosh(rng, d, 500, 1800, 1.1, 0.55, 0.4)
        else:  # rack
            w = whoosh(rng, d, 400, 1600, 1.1, 0.5, 0.4)
        pan = keys([(0, 0.5), (len(w) / SR, -0.5)], len(w)) if kind == "whip" else np.zeros(len(w))
        lvl = LV["whoosh"] - (5 if kind == "rack" else 0)
        add(mx, "tr", pan_st(w, pan), f - dur / 2 - 4, lvl, 0.0, {"air": -10})


BUILDERS = [build_s01, build_s02, build_clock, build_days, build_body_beds, build_s03, build_s04, build_s05, build_s06,
            build_s07, build_s08, build_s09, build_s10, build_s11, build_s12, build_s13, build_s14, build_s15, build_s16,
            build_s17, build_s18_static, build_s19, build_s20, build_transitions]


def cut_clips(mx, frame, fade=0.008):
    """Hard cut: every clip that crosses `frame` (started before it) is truncated there (8 ms fade)."""
    s = idx(fsec(frame))
    k = max(1, idx(fade))
    for bus, cl in mx.clips.items():
        for i, (a0, x) in enumerate(cl):
            if a0 < s < a0 + len(x):
                x = x[: s - a0].copy()
                m = min(k, len(x))
                x[len(x) - m:] *= (np.cos(np.linspace(0, np.pi / 2, m)) ** 2)[:, None].astype(np.float32)
                cl[i] = (a0, x)


def mix_groups(mx, act, total, groups=None):
    """Render each group (float32), carve its speech band + duck it under the VO, add into total."""
    for g in (groups or mx.groups()):
        y = render_f32(mx, group=g)
        duck_carve_into(total, y, act, DUCK_DB[g], SPEECH_DUCK_DB.get(g, 0.0), db(SFX_GAIN))
        del y
    return total


def main():
    t0 = time.time()
    rv = {
        "kitchen": (make_ir(0.5, 41, predelay=0.005, damp_hz=5000, hi_ratio=0.5, lowcut=200, early=0.5), "fx_kitchenverb"),
        "drop": (make_ir(3.4, 42, predelay=0.025, damp_hz=7500, hi_ratio=0.7, lowcut=300), "hero_dropverb"),
        "bath": (make_ir(0.9, 43, predelay=0.004, damp_hz=7000, hi_ratio=0.7, lowcut=200, early=0.7), "fx_bathverb"),
        "micro": (make_ir(0.9, 44, predelay=0.01, damp_hz=6500, hi_ratio=0.6, lowcut=250), "tex_verb"),
        "air": (make_ir(1.4, 45, predelay=0.012, damp_hz=7000, hi_ratio=0.6, lowcut=250), "tex_airverb"),
        "room": (make_ir(0.45, 46, predelay=0.006, damp_hz=4500, hi_ratio=0.5, lowcut=200, early=0.4), "fx_roomverb"),
        "body": (make_ir(0.6, 47, predelay=0.006, damp_hz=1500, hi_ratio=0.4, lowcut=60), "body_verb"),
        "big": (make_ir(2.6, 48, predelay=0.02, damp_hz=3000, hi_ratio=0.5, lowcut=60), "hit_verb"),
    }
    act = vo_activity()  # float32; computed first, while little else is in RAM
    clear_activity()
    mx = ClipMixer(rv)
    for fn in BUILDERS:
        fn(mx)
        print(f"  {fn.__name__:18s} {time.time() - t0:5.1f}s")
    cut_clips(mx, F_CUT)

    if "--buses" in sys.argv:  # per-bus peak (dBFS, before duck/carve) per scene, from the clips
        for bus in mx.buses():
            pk = {}
            for a0, x in mx.clips[bus]:
                for sid, sa, sb in SCENES:
                    lo, hi = max(a0, idx(fsec(sa))), min(a0 + len(x), idx(fsec(sb)))
                    if hi > lo:
                        pk[sid] = max(pk.get(sid, 0.0), float(np.max(np.abs(x[lo - a0:hi - a0]))))
            print(f"  {bus:16s} " + " ".join(f"{s}:{20*np.log10(v+1e-20):4.0f}" for s, v in pk.items()))
        if "--report-only" in sys.argv:
            return
    # the end (VO out 73.6 s): let the kitchen + birds come up only ~half the duck depth under the fade
    e0 = idx(73.7)
    act[e0:] = np.maximum(act[e0:], (np.clip((np.arange(N - e0) / SR) / 0.5, 0, 1) * 0.5).astype(np.float32))
    total = np.zeros((N, 2), dtype=np.float32)
    mix_groups(mx, act, total)
    del mx
    # S18: the tape garble (built from the sound rendered so far), ducked + carved under "Now rewind."
    gm = ClipMixer()
    gm.add("rw_garble", make_garble(total), fsec(F_RW_RUN[0]), LV["rw"])
    mix_groups(gm, act, total, ["rw"])
    del gm, act
    filt_inplace(total, sos("hp", 30, 2))
    # exact digital silence on the black frame of the dip S16 -> S17
    a, b = idx(fsec(F_SILENCE[0])), idx(fsec(F_SILENCE[1]))
    k = idx(0.02)
    total[a - k:a] *= (np.cos(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    total[a:b] = 0.0
    total[b:b + k] *= (np.sin(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    end_fade_tail(total)
    out = PUB / "audio" / "sfx.wav"
    pk = np.max(np.abs(total))
    print(f"  pre-write peak {20*np.log10(pk):.2f} dBFS")
    if pk > db(-3.2):
        total *= db(-3.2) / pk
        print(f"  (trimmed {20*np.log10(pk) + 3.2:.2f} dB to -3.2 dBFS peak)")
    write_wav(out, total, seed=11)
    write_manifest()
    print(f"wrote {out}  ({time.time() - t0:.1f}s)")
    section_report("sfx", total)


if __name__ == "__main__":
    main()
