"""Instagram-standard delivery encode (see memory: earlier reels displayed ~1:1 on IG).

    python scripts/ig_encode.py [--src out/no-water-master.mp4] [--out out/no-water-final.mp4]

Re-encodes the mastered mux to: H.264 High@4.1, yuv420p LIMITED (tv) range, full bt709 tags
(matrix/primaries/transfer), SAR 1:1 + DAR 9:16, CRF 19 capped at 16 Mbps, 30 fps CFR, AAC-LC
256k 48 kHz stereo, +faststart. Uses Remotion's bundled ffmpeg (has libx264, scale, no setsar).
"""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BIN = ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc"
FFMPEG = BIN / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
FFPROBE = BIN / ("ffprobe.exe" if sys.platform == "win32" else "ffprobe")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(ROOT / "out" / "no-water-master.mp4"))
    ap.add_argument("--out", default=str(ROOT / "out" / "no-water-final.mp4"))
    a = ap.parse_args()
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", a.src,
           "-vf", "scale=1080:1920:flags=lanczos:in_range=auto:out_range=tv:out_color_matrix=bt709,format=yuv420p",
           "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-level:v", "4.1",
           "-crf", "19", "-maxrate", "16M", "-bufsize", "32M", "-r", "30", "-g", "60",
           "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-aspect", "9:16", "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv",
           "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
           "-movflags", "+faststart", a.out]
    subprocess.run([str(c) for c in cmd], check=True)
    r = subprocess.run([str(FFPROBE), "-v", "error", "-show_entries",
                        "stream=codec_name,profile,level,width,height,pix_fmt,color_range,color_space,color_primaries,"
                        "color_transfer,sample_aspect_ratio,display_aspect_ratio,r_frame_rate,bit_rate,sample_rate,channels"
                        ":format=duration,size,bit_rate", "-of", "compact", a.out], capture_output=True, text=True)
    print(r.stdout)


if __name__ == "__main__":
    main()
