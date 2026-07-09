#!/usr/bin/env python3
"""
edge-tts narration worker for AI-YouTube (Module 08 replacement).

Modes:
  Daemon (no args): watch /data/output/_tts_jobs/ for <story_id>.job files,
    narrate each, and write <story_id>.result (mirrors watch-render.sh).
  One-shot: `python narrate_worker.py <story_id>` -> narrate once and exit.

Reads:  /data/output/scenes/<story_id>.json   (scenes[].narration / .scene_number)
        /data/prompts/tts-config.json          (edge_voice, edge_rate; optional)
Writes: /data/output/audio/<story_id>_scene-NN.wav
        /data/output/audio/<story_id>_audio.json   (manifest for assemble/stills)
"""
import os, sys, json, time, subprocess, tempfile, datetime, glob, traceback

DATA = "/data"
SCENES_DIR = DATA + "/output/scenes"
AUDIO_DIR  = DATA + "/output/audio"
JOBS_DIR   = DATA + "/output/_tts_jobs"
CFG_PATH   = DATA + "/prompts/tts-config.json"
LOG        = DATA + "/logs/narrate.log"


def log(msg):
    line = datetime.datetime.utcnow().isoformat() + "Z " + str(msg)
    print(line, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_cfg():
    try:
        with open(CFG_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def narrate(story_id):
    c = load_cfg()
    voice = c.get("edge_voice", "en-US-JennyNeural")
    rate = c.get("edge_rate", "+0%")

    scenes_path = SCENES_DIR + "/" + story_id + ".json"
    with open(scenes_path, encoding="utf-8") as f:
        sc = json.load(f)
    sc = sc.get("data", sc)
    scenes = sc.get("scenes", [])
    if not scenes:
        raise RuntimeError("no scenes in " + scenes_path)

    os.makedirs(AUDIO_DIR, exist_ok=True)
    clips = []
    for s in scenes:
        num = int(s.get("scene_number"))
        text = (s.get("narration") or "").strip()
        nn = "%02d" % num
        if not text:
            log("  scene " + nn + ": empty narration, skipping")
            continue
        wav = AUDIO_DIR + "/" + story_id + "_scene-" + nn + ".wav"
        with tempfile.TemporaryDirectory() as td:
            txt = os.path.join(td, "t.txt")
            mp3 = os.path.join(td, "a.mp3")
            with open(txt, "w", encoding="utf-8") as tf:
                tf.write(text)
            ok = False
            for attempt in range(4):
                r = subprocess.run(
                    ["edge-tts", "--voice", voice, "--rate", rate,
                     "--file", txt, "--write-media", mp3],
                    capture_output=True, text=True)
                if r.returncode == 0 and os.path.exists(mp3) and os.path.getsize(mp3) > 0:
                    ok = True
                    break
                log("  scene " + nn + ": edge-tts attempt " + str(attempt + 1) +
                    " failed: " + (r.stderr or "").strip()[:120])
                time.sleep(3)
            if not ok:
                raise RuntimeError("edge-tts failed for scene " + nn)
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", mp3,
                 "-ar", "24000", "-ac", "1", wav], check=True)
        dur = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", wav],
            capture_output=True, text=True).stdout.strip()
        dur = round(float(dur or 0), 2)
        clips.append({"scene_number": num,
                      "file": story_id + "_scene-" + nn + ".wav",
                      "duration_seconds": dur})
        log("  scene " + nn + ": " + str(dur) + "s")

    clips.sort(key=lambda x: x["scene_number"])
    total = round(sum(c["duration_seconds"] for c in clips), 2)
    manifest = {
        "story_id": story_id,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "tts_engine": "edge-tts",
        "voice": voice,
        "clip_count": len(clips),
        "total_audio_duration_seconds": total,
        "clips": clips,
    }
    with open(AUDIO_DIR + "/" + story_id + "_audio.json", "w") as f:
        json.dump(manifest, f, indent=2)
    log("NARRATED " + story_id + ": " + str(len(clips)) + " clips, " + str(total) + "s")
    return manifest


def worker():
    os.makedirs(JOBS_DIR, exist_ok=True)
    log("narrate worker started")
    while True:
        for job in glob.glob(JOBS_DIR + "/*.job"):
            story_id = os.path.basename(job)[:-4]
            proc = JOBS_DIR + "/" + story_id + ".processing"
            try:
                os.rename(job, proc)   # claim atomically
            except OSError:
                continue
            res = JOBS_DIR + "/" + story_id + ".result"
            try:
                if os.path.exists(res):
                    os.remove(res)
            except OSError:
                pass
            log("narrating " + story_id)
            try:
                m = narrate(story_id)
                with open(res, "w") as f:
                    json.dump({"story_id": story_id, "status": "done",
                               "clip_count": m["clip_count"],
                               "manifest": "/data/output/audio/" + story_id + "_audio.json"}, f)
            except Exception as e:
                log("ERROR " + story_id + ": " + repr(e))
                log(traceback.format_exc())
                with open(res, "w") as f:
                    json.dump({"story_id": story_id, "status": "error", "error": str(e)}, f)
            finally:
                try:
                    os.remove(proc)
                except OSError:
                    pass
        time.sleep(3)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        narrate(sys.argv[1])
    else:
        worker()
