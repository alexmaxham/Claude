#!/usr/bin/env python3
"""Runs Volta's app benchmark on an iPhone from a Mac.

The iPhone can't drive other apps or read its own battery current, so the Mac does both: an Xcode
UI test (../Runner) opens and drives each app on the phone, and this script records the battery
every 15 seconds through pymobiledevice3, then works out the results the same way Volta does.

  python3 volta_bench.py check            # one battery reading, the phone's details and which apps are installed
  python3 volta_bench.py run --team ABCDE12345
  python3 volta_bench.py report [RUN]     # results of the latest (or a named) run, also while one is going
  python3 volta_bench.py list
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import shlex
import signal
import subprocess
import sys
import threading
import time
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Optional

import benchmark as b

HERE = Path(__file__).resolve().parent
PROJECT_DIR = HERE.parent
RUNS = PROJECT_DIR / "runs"
BUILD = PROJECT_DIR / "build"

SAMPLE_EVERY = 15  # seconds, as Volta's review recording

# A runner that stops without saying the run is over (Wi-Fi dropped, Xcode lost the phone) is
# started again; it picks up the slot the schedule says it should be in.
MAX_RESTARTS = 30

# What each step needs installed. The camera is built in.
BUNDLES = {
    "chrome": "com.google.chrome.ios",
    "safari": "com.apple.mobilesafari",
    "youtube": "com.google.ios.youtube",
    "instagram": "com.burbn.instagram",
    "camera": "com.apple.camera",
    "tiktok": "com.zhiliaoapp.musically",
    "x": "com.atebits.Tweetie2",
    "ytmusic": "com.google.ios.youtubemusic",
    "subway": "com.kiloo.subwaysurfers",
}
BUILT_IN = {"camera", "safari"}

CHECKLIST = [
    "Auto-Brightness is off (Settings → Accessibility → Display & Text Size)",
    "Brightness is set to 200 nits with a lux meter",
    "True Tone and Night Shift are off",
    "Auto-Lock is set to Never (Settings → Display & Brightness)",
    "Low Power Mode is off and Focus / Do Not Disturb is on",
    "Each app is signed in, past its first-run screens, and Camera is set to 4K 60 fps",
    "There's room for an hour of 4K60 video (about 25 GB)",
    "The phone is at 100% and unplugged, and connected to this Mac over Wi-Fi",
]


def say(msg: str) -> None:
    print(msg, flush=True)


def now_ms() -> int:
    return int(time.time() * 1000)


# The phone, through pymobiledevice3


class Phone:
    def __init__(self, udid: Optional[str], extra: list[str]):
        self.udid = udid
        self.extra = extra

    def _pmd3(self, *args: str, timeout: int = 60) -> object:
        cmd = [sys.executable, "-m", "pymobiledevice3", *args, *self.extra]
        if self.udid:
            cmd += ["--udid", self.udid]
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if p.returncode != 0:
            raise RuntimeError((p.stderr or p.stdout).strip().splitlines()[-1] if (p.stderr or p.stdout).strip() else f"{' '.join(args)} failed")
        return json.loads(p.stdout)

    def info(self) -> dict:
        return self._pmd3("lockdown", "info")

    def battery(self) -> Optional[b.Reading]:
        return b.reading_from_battery(self._pmd3("diagnostics", "battery", "single", timeout=30) or {}, now_ms())

    def apps(self) -> set[str]:
        out = self._pmd3("apps", "list", "--type", "User", timeout=120)
        return set(out.keys() if isinstance(out, dict) else (a.get("CFBundleIdentifier") for a in out))


def phone_name(info: dict) -> str:
    return info.get("DeviceName") or info.get("ProductType") or "iPhone"


def software(info: dict) -> str:
    return f"iOS {info.get('ProductVersion', '?')} · {info.get('BuildVersion', '?')} · {info.get('ProductType', '')}".rstrip(" ·")


# Runs on disk: runs/<id>/run.json, readings.jsonl, events.jsonl, xcodebuild.log


def run_dir(run_id: str) -> Path:
    return RUNS / run_id


def save_run(run_id: str, data: dict) -> None:
    p = run_dir(run_id) / "run.json"
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(p)


def load(run_id: str) -> tuple[dict, b.ReviewRun, list[b.BenchSegment]]:
    d = run_dir(run_id)
    meta = json.loads((d / "run.json").read_text())
    samples, events = [], []
    for line in (d / "readings.jsonl").read_text().splitlines() if (d / "readings.jsonl").exists() else []:
        samples.append(b.Reading(**json.loads(line)))
    for line in (d / "events.jsonl").read_text().splitlines() if (d / "events.jsonl").exists() else []:
        events.append(json.loads(line))
    run = b.ReviewRun(meta["id"], meta["started"], meta.get("ended"), b.Conditions(**meta["conditions"]), samples)
    return meta, run, b.segments_from_events(events, meta.get("ended"))


def latest_run() -> Optional[str]:
    runs = sorted((p for p in RUNS.glob("*/run.json")), key=lambda p: json.loads(p.read_text())["started"]) if RUNS.exists() else []
    return runs[-1].parent.name if runs else None


def write_results(run_id: str, fahrenheit: bool = False) -> str:
    meta, run, segs = load(run_id)
    rep = b.report(run, segs, now_ms())
    d = run_dir(run_id)
    summary = b.text(run, rep, fahrenheit)
    (d / "results.txt").write_text(summary + "\n")
    (d / "results.csv").write_text(b.csv(run, rep))
    if run.ended is not None:
        (d / "volta-backup.json").write_text(b.backup(run, segs))
    return summary


# Building and running the UI test


def xcode_settings(args) -> list[str]:
    s = [f"BUNDLE_PREFIX={args.bundle_prefix}"]
    if args.team:
        s.append(f"DEVELOPMENT_TEAM={args.team}")
    return s


def build(args, udid: str) -> None:
    if not (PROJECT_DIR / "VoltaBench.xcodeproj").exists() or (PROJECT_DIR / "project.yml").stat().st_mtime > (PROJECT_DIR / "VoltaBench.xcodeproj").stat().st_mtime:
        say("Generating the Xcode project…")
        subprocess.run(["xcodegen", "generate", "--spec", str(PROJECT_DIR / "project.yml")], cwd=PROJECT_DIR, check=True)
    say("Building the runner for the phone (the first build takes a minute or two)…")
    cmd = [
        "xcodebuild", "build-for-testing",
        "-project", str(PROJECT_DIR / "VoltaBench.xcodeproj"), "-scheme", "VoltaBench",
        "-destination", f"id={udid}", "-derivedDataPath", str(BUILD), "-allowProvisioningUpdates",
        *xcode_settings(args),
    ]
    log = BUILD / "build.log"
    BUILD.mkdir(exist_ok=True)
    with log.open("w") as f:
        p = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT)
    if p.returncode != 0:
        tail = log.read_text().splitlines()[-25:]
        sys.exit("Build failed:\n" + "\n".join(tail) + f"\n\nFull log: {log}\nIs --team set to your Apple developer team ID?")


class Recorder:
    """Reads the battery every 15 seconds and decides when the run is over."""

    def __init__(self, phone: Phone, run_id: str, stop_level: int):
        self.phone = phone
        self.path = run_dir(run_id) / "readings.jsonl"
        self.stop_level = stop_level
        self.reason: Optional[str] = None
        self.last: Optional[b.Reading] = None
        self.failures = 0
        self._stop = threading.Event()
        self.thread = threading.Thread(target=self._loop, daemon=True)

    def start(self):
        self.thread.start()

    def stop(self):
        self._stop.set()
        self.thread.join(timeout=40)

    def _loop(self):
        while not self._stop.is_set():
            try:
                r = self.phone.battery()
                self.failures = 0
            except Exception as e:  # noqa: BLE001 - keep recording through a dropped connection
                r = None
                self.failures += 1
                if self.failures in (1, 4) or self.failures % 20 == 0:
                    say(f"  Couldn't read the battery ({e}). Retrying…")
            if r is not None and (self.last is None or r.time > self.last.time):
                with self.path.open("a") as f:
                    f.write(json.dumps(asdict(r)) + "\n")
                self.last = r
                if r.plugged:
                    self.reason = "The charger was connected"
                elif r.level <= self.stop_level:
                    self.reason = f"The battery reached {r.level}%"
            # No readings for ten minutes means the phone ran out or dropped off the network for good.
            if self.last is not None and now_ms() - self.last.time > 10 * b.MINUTE:
                self.reason = self.reason or "The phone stopped answering"
            if self.reason:
                return
            self._stop.wait(SAMPLE_EVERY)


def drive(args, udid: str, meta: dict, recorder: Recorder) -> str:
    """Runs the UI test until the run is over, starting it again if it stops early. Returns why it ended."""
    run_id = meta["id"]
    d = run_dir(run_id)
    env = dict(os.environ)
    env.update(
        {
            # xcodebuild passes TEST_RUNNER_* variables to the test without the prefix.
            "TEST_RUNNER_VOLTA_RUN_ID": run_id,
            "TEST_RUNNER_VOLTA_STARTED": str(meta["started"]),
            "TEST_RUNNER_VOLTA_STOP_LEVEL": str(meta["stop_level"]),
            "TEST_RUNNER_VOLTA_STEPS": base64.b64encode(json.dumps(meta["steps"]).encode()).decode(),
            "TEST_RUNNER_VOLTA_WAIT_FOR_IDLE": "1" if args.wait_for_idle else "0",
        }
    )
    cmd = [
        "xcodebuild", "test-without-building",
        "-project", str(PROJECT_DIR / "VoltaBench.xcodeproj"), "-scheme", "VoltaBench",
        "-destination", f"id={udid}", "-derivedDataPath", str(BUILD),
        "-only-testing:VoltaBenchRunner/AppBenchmark/testAppBenchmark",
        *xcode_settings(args),
    ]
    restarts = 0
    while True:
        say("Starting the runner on the phone…" if restarts == 0 else f"Starting the runner again ({restarts})…")
        ended: Optional[str] = None
        with (d / "xcodebuild.log").open("a") as log, (d / "events.jsonl").open("a") as events:
            p = subprocess.Popen(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
            watcher = threading.Thread(target=_stop_when_over, args=(p, recorder), daemon=True)
            watcher.start()
            for line in p.stdout:
                log.write(line)
                i = line.find("VOLTA|")
                if i < 0:
                    continue
                try:
                    e = json.loads(line[i + 6:])
                except json.JSONDecodeError:
                    continue
                events.write(json.dumps(e) + "\n")
                events.flush()
                if e.get("kind") == "slot":
                    say(f"  {time.strftime('%H:%M')}  {b.name(e['step'])} · round {e['round'] + 1}")
                elif e.get("kind") == "relaunch":
                    say(f"  {time.strftime('%H:%M')}  Brought {b.name(e.get('step', ''))} back to the front")
                elif e.get("kind") == "missing":
                    say(f"  {e.get('message')}")
                elif e.get("kind") == "end":
                    ended = e.get("reason") or "The runner finished"
            p.wait()
        if recorder.reason:
            return recorder.reason
        if ended:
            return ended
        restarts += 1
        if restarts > MAX_RESTARTS:
            return "The runner kept stopping (see xcodebuild.log)"
        time.sleep(10)


def _stop_when_over(p: subprocess.Popen, recorder: Recorder) -> None:
    while p.poll() is None:
        if recorder.reason:
            p.send_signal(signal.SIGINT)
            try:
                p.wait(timeout=30)
            except subprocess.TimeoutExpired:
                p.kill()
            return
        time.sleep(2)


# Commands


def parse_steps(args) -> list[b.BenchStep]:
    ids = [s.strip() for s in args.apps.split(",") if s.strip()]
    links = dict(l.split("=", 1) for l in args.link)
    steps = []
    for i in ids:
        if i not in BUNDLES:
            sys.exit(f"Unknown app '{i}'. Choose from: {', '.join(BUNDLES)}")
        if i == "chrome" and args.browser == "safari":
            i = "safari"
        steps.append(b.BenchStep(i, b.name(i), args.minutes, links.get(i, links.get("chrome" if i == "safari" else i, "")).strip()))
    return steps


def cmd_check(args) -> None:
    phone = Phone(args.udid, shlex.split(args.pmd3_args))
    info = phone.info()
    say(f"{phone_name(info)} · {software(info)} · UDID {info.get('UniqueDeviceID')}")
    r = phone.battery()
    if r is None:
        sys.exit("The phone answered but didn't report its battery.")
    parts = [f"{r.level}%", "plugged in" if r.plugged else "on battery"]
    if r.current_ma is not None:
        parts.append(f"{r.current_ma} mA")
    if r.power_w is not None:
        parts.append(f"{r.power_w:.2f} W")
    if r.temp_c is not None:
        parts.append(f"{r.temp_c:.1f} °C")
    if r.charge_counter_mah is not None:
        parts.append(f"{r.charge_counter_mah:.0f} mAh left")
    say("Battery: " + " · ".join(parts))
    if r.current_ma is None or r.temp_c is None:
        say("This connection doesn't give current or temperature; results will only show points per hour.")
    installed = phone.apps()
    for sid, bundle in BUNDLES.items():
        mark = "built in" if sid in BUILT_IN else ("installed" if bundle in installed else "not installed")
        say(f"  {b.name(sid):<16} {mark}")


def cmd_run(args) -> None:
    phone = Phone(args.udid, shlex.split(args.pmd3_args))
    say("Checking the phone…")
    info = phone.info()
    udid = args.udid or info.get("UniqueDeviceID")
    first = phone.battery()
    if first is None:
        sys.exit("Couldn't read the phone's battery. Run `python3 volta_bench.py check` to see why.")
    steps = parse_steps(args)
    installed = phone.apps()
    missing = [s for s in steps if s.id not in BUILT_IN and BUNDLES[s.id] not in installed]
    if missing:
        say("Leaving out apps that aren't installed: " + ", ".join(s.name for s in missing))
        steps = [s for s in steps if s not in missing]
    if not steps:
        sys.exit("None of the benchmark apps are installed.")

    say("\nBefore you start:")
    for item in CHECKLIST:
        say(f"  • {item}")
    if first.plugged or first.level < 100:
        say(f"\nThe phone is at {first.level}%{' and plugged in' if first.plugged else ''}. Volta starts benchmarks at 100% on battery.")
    if not args.yes and input("\nAll set? Start the benchmark [y/N] ").strip().lower() not in ("y", "yes"):
        sys.exit("Not started.")

    build(args, udid)

    run_id = str(uuid.uuid4())
    run_dir(run_id).mkdir(parents=True)
    started = now_ms()
    conditions = b.Conditions(
        phone=args.phone or phone_name(info),
        software=software(info),
        protocol=b.PROTOCOL,
        type="DRAIN",
        brightness="200 nits (lux meter)",
        network=args.network,
        notes="Auto brightness off, started at 100%. "
        + ", ".join(f"{s.name} {s.minutes} min" + (f" ({s.link})" if s.link else "") for s in steps)
        + f", then repeat until {args.stop_level}%. Driven from a Mac by Xcode UI testing.",
    )
    meta = {
        "id": run_id,
        "started": started,
        "ended": None,
        "udid": udid,
        "stop_level": args.stop_level,
        "steps": [asdict(s) for s in steps],
        "conditions": asdict(conditions),
    }
    save_run(run_id, meta)
    say(f"\nRun {run_id} started. Results so far: python3 volta_bench.py report {run_id}")
    say("Press Ctrl+C to finish early.\n")

    # Keeps the Mac awake for as long as this script runs.
    awake = subprocess.Popen(["caffeinate", "-dimsu", "-w", str(os.getpid())]) if sys.platform == "darwin" else None
    recorder = Recorder(phone, run_id, args.stop_level)
    recorder.start()
    try:
        reason = drive(args, udid, meta, recorder)
    except KeyboardInterrupt:
        reason = "Stopped from the Mac"
        recorder.reason = recorder.reason or reason
    recorder.stop()
    if awake:
        awake.terminate()

    last = recorder.last.time if recorder.last else now_ms()
    meta["ended"] = min(now_ms(), last + SAMPLE_EVERY * 1000) if reason == "The phone stopped answering" else now_ms()
    meta["reason"] = reason
    save_run(run_id, meta)
    say(f"\n{reason} after {b.fmt_duration(meta['ended'] - started)}.\n")
    say(write_results(run_id, args.fahrenheit))
    d = run_dir(run_id)
    say(f"\nSaved {d / 'results.csv'}\nand {d / 'volta-backup.json'} (open it in Volta on Android: Lab → Import to compare with Android runs).")


def cmd_report(args) -> None:
    run_id = args.run or latest_run()
    if not run_id or not (run_dir(run_id) / "run.json").exists():
        sys.exit("No runs yet.")
    say(write_results(run_id, args.fahrenheit))
    say(f"\nCSV: {run_dir(run_id) / 'results.csv'}")


def cmd_list(_args) -> None:
    if not RUNS.exists():
        return say("No runs yet.")
    for p in sorted(RUNS.glob("*/run.json"), key=lambda p: json.loads(p.read_text())["started"]):
        m = json.loads(p.read_text())
        when = time.strftime("%Y-%m-%d %H:%M", time.localtime(m["started"] / 1000))
        state = m.get("reason") or "running"
        say(f"{m['id']}  {when}  {m['conditions']['phone']}  {state}")


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--udid", default=os.environ.get("VOLTA_UDID"), help="the iPhone's UDID (default: the only connected one)")
    ap.add_argument("--pmd3-args", default=os.environ.get("VOLTA_PMD3_ARGS", ""), help="extra pymobiledevice3 options, e.g. '--mobdev2' to find the phone over Wi-Fi")
    sub = ap.add_subparsers(dest="command", required=True)

    sub.add_parser("check", help="read the battery once and list the installed benchmark apps").set_defaults(fn=cmd_check)

    run = sub.add_parser("run", help="start a benchmark")
    run.add_argument("--team", default=os.environ.get("VOLTA_TEAM"), help="Apple developer team ID for signing the runner")
    run.add_argument("--bundle-prefix", default=os.environ.get("VOLTA_BUNDLE_PREFIX", "com.alexmaxham"), help="bundle ID prefix (must be yours to sign)")
    run.add_argument("--apps", default=",".join(s.id for s in b.DEFAULT), help="the apps in order, comma-separated")
    run.add_argument("--minutes", type=int, default=60, help="minutes in each app")
    run.add_argument("--browser", choices=["chrome", "safari"], default="chrome", help="browser for the web step")
    run.add_argument("--link", action="append", default=[], metavar="APP=URL", help="content to play, e.g. youtube=https://youtu.be/… or ytmusic=https://music.youtube.com/playlist?list=…")
    run.add_argument("--stop-level", type=int, default=b.STOP_LEVEL)
    run.add_argument("--phone", help="the phone's name in results (default: its name in Settings)")
    run.add_argument("--network", default="Wi-Fi", help="network the phone uses, for the results")
    run.add_argument("--wait-for-idle", action="store_true", help="let XCTest wait for each app to settle before every gesture (slower in video apps and games)")
    run.add_argument("--fahrenheit", action="store_true")
    run.add_argument("-y", "--yes", action="store_true", help="skip the checklist prompt")
    run.set_defaults(fn=cmd_run)

    rep = sub.add_parser("report", help="print and save a run's results")
    rep.add_argument("run", nargs="?")
    rep.add_argument("--fahrenheit", action="store_true")
    rep.set_defaults(fn=cmd_report)

    sub.add_parser("list", help="list runs").set_defaults(fn=cmd_list)

    args = ap.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
