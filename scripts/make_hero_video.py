import os
import shutil
import subprocess
from PIL import Image

workspace_dir = r"f:\قرصf\New folder (24)\New folder (6)\New folder (12)"
src_dir = os.path.join(workspace_dir, "ص")
app_dir = os.path.join(workspace_dir, "screenshot-match-main")
public_dir = os.path.join(app_dir, "public")
frames_dest = os.path.join(public_dir, "hero-frames")

os.makedirs(frames_dest, exist_ok=True)

# Copy all 20 frames
frame_files = sorted([f for f in os.listdir(src_dir) if f.endswith(".webp")])
# Avoid printing non-ascii to cp1252 terminal
print(f"Found {len(frame_files)} frames")
for f in frame_files:
    shutil.copy2(os.path.join(src_dir, f), os.path.join(frames_dest, f))

# Let's create an optimized poster image as well (first frame)
shutil.copy2(os.path.join(frames_dest, "frame_00000.webp"), os.path.join(public_dir, "hero-poster.webp"))

# Now let's create seamless looping ping-pong video with high quality & 60fps interpolation if possible or clean 24fps
# Let's build the frame list: 0..19 then 18..1
sequence = list(range(20)) + list(range(18, 0, -1))
print("Sequence length:", len(sequence))

# Generate sequence of webp images in a temporary render directory
render_dir = os.path.join(public_dir, "_render_temp")
os.makedirs(render_dir, exist_ok=True)

for idx, f_num in enumerate(sequence):
    src_f = os.path.join(frames_dest, f"frame_{f_num:05d}.webp")
    dst_f = os.path.join(render_dir, f"seq_{idx:05d}.webp")
    shutil.copy2(src_f, dst_f)

# Let's encode with ffmpeg
# 12 fps for natural gentle water flow (38 frames = ~3.16 seconds per full breathing cycle)
# Or minterpolate to 60fps for hyper-fluid buttery motion!
mp4_output = os.path.join(public_dir, "hero-video.mp4")
webm_output = os.path.join(public_dir, "hero-video.webm")

# Let's test minterpolate to 60fps for butter smoothness
cmd_mp4_interpolated = [
    "ffmpeg", "-y",
    "-framerate", "12",
    "-i", os.path.join(render_dir, "seq_%05d.webp"),
    "-vf", "minterpolate='fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1'",
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level", "4.1",
    "-pix_fmt", "yuv420p",
    "-crf", "18",
    "-preset", "slow",
    "-movflags", "+faststart",
    mp4_output
]

print("Running ffmpeg MP4 with 60fps motion interpolation...")
res = subprocess.run(cmd_mp4_interpolated, capture_output=True, text=True)
if res.returncode != 0:
    print("Minterpolate failed, falling back to standard 24fps smooth blend...")
    print(res.stderr[:500])
    cmd_fallback = [
        "ffmpeg", "-y",
        "-framerate", "12",
        "-i", os.path.join(render_dir, "seq_%05d.webp"),
        "-c:v", "libx264",
        "-profile:v", "high",
        "-level", "4.1",
        "-pix_fmt", "yuv420p",
        "-crf", "18",
        "-preset", "slow",
        "-movflags", "+faststart",
        mp4_output
    ]
    subprocess.run(cmd_fallback, check=True)

# Also generate WebM (VP9)
print("Generating WebM...")
cmd_webm = [
    "ffmpeg", "-y",
    "-i", mp4_output,
    "-c:v", "libvpx-vp9",
    "-crf", "22",
    "-b:v", "0",
    webm_output
]
subprocess.run(cmd_webm, check=True)

# Clean up temp
shutil.rmtree(render_dir)

print("SUCCESS!")
print("MP4 Size:", os.path.getsize(mp4_output), "bytes")
print("WebM Size:", os.path.getsize(webm_output), "bytes")
