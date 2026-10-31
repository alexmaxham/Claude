"""The app benchmark's schedule and results, ported from Volta's core/Benchmark.kt so iPhone runs
are measured the same way as Android ones. Times are epoch milliseconds."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from typing import Callable, Optional

SECOND = 1000
MINUTE = 60 * SECOND
HOUR = 60 * MINUTE

PROTOCOL = "App benchmark"

# The run ends when the battery reaches this level, before the phone shuts itself down.
STOP_LEVEL = 3

# Volta's run backup format, so an iPhone run can be imported into Volta on Android and compared there.
BACKUP_FORMAT = "volta-review-run"


@dataclass
class Reading:
    time: int
    level: int
    plugged: bool
    temp_c: Optional[float] = None
    voltage_v: Optional[float] = None
    # Negative while discharging, as in Volta.
    current_ma: Optional[int] = None
    charge_counter_mah: Optional[float] = None

    @property
    def power_w(self) -> Optional[float]:
        """Net battery power in watts, positive while charging. None when the phone doesn't report both values."""
        if self.voltage_v is not None and self.current_ma is not None and self.voltage_v > 0:
            return self.voltage_v * self.current_ma / 1000
        return None


@dataclass
class Conditions:
    phone: str = ""
    software: str = ""
    protocol: str = ""
    type: str = "DRAIN"
    brightness: str = ""
    refresh_rate: str = ""
    resolution: str = ""
    network: str = ""
    performance: str = ""
    charger: str = ""
    notes: str = ""
    review_recording: bool = True


@dataclass
class ReviewRun:
    id: str
    started: int
    ended: Optional[int]
    conditions: Conditions
    samples: list[Reading]

    @property
    def active(self) -> bool:
        return self.ended is None


@dataclass
class BenchStep:
    """One app in the benchmark loop. [link] is optional content to open, such as a video or playlist."""

    id: str
    name: str
    minutes: int = 60
    link: str = ""


@dataclass
class BenchPosition:
    index: int
    round: int
    step: BenchStep
    start: int
    end: int


@dataclass
class BenchSegment:
    """One app slot as it actually ran. [relaunches] counts the times the app was brought back after something else took over."""

    index: int
    round: int
    step_id: str
    start: int
    end: Optional[int]
    relaunches: int = 0


@dataclass
class SegmentResult:
    segment: BenchSegment
    name: str
    round: int
    duration: int
    start_level: Optional[int]
    end_level: Optional[int]
    used: Optional[int]
    mah: Optional[float]
    avg_power_w: Optional[float]
    avg_temp_c: Optional[float]
    peak_temp_c: Optional[float]

    @property
    def hours(self) -> float:
        return self.duration / HOUR

    @property
    def per_hour(self) -> Optional[float]:
        return self.used / self.hours if self.used is not None and self.duration >= 10 * MINUTE else None

    @property
    def mah_per_hour(self) -> Optional[float]:
        return self.mah / self.hours if self.mah is not None and self.duration >= 10 * MINUTE else None


@dataclass
class AppResult:
    step_id: str
    name: str
    slots: int
    duration: int
    used: int
    mah: Optional[float]
    avg_power_w: Optional[float]
    avg_temp_c: Optional[float]
    peak_temp_c: Optional[float]
    relaunches: int

    @property
    def per_hour(self) -> Optional[float]:
        return self.used * HOUR / self.duration if self.duration >= 10 * MINUTE else None

    @property
    def mah_per_hour(self) -> Optional[float]:
        return self.mah * HOUR / self.duration if self.mah is not None and self.duration >= 10 * MINUTE else None


@dataclass
class BenchReport:
    elapsed: int
    start_level: Optional[int]
    end_level: Optional[int]
    # Rounds started; the last one may be partial.
    rounds: int
    apps: list[AppResult]
    segments: list[SegmentResult]
    avg_temp_c: Optional[float]
    peak_temp_c: Optional[float]


# The default loop: an hour in each app, in this order, then round again. Same ids as on Android,
# with Safari as an alternative to Chrome.
DEFAULT = [
    BenchStep("chrome", "Chrome"),
    BenchStep("youtube", "YouTube"),
    BenchStep("instagram", "Instagram"),
    BenchStep("camera", "Camera 4K60"),
    BenchStep("tiktok", "TikTok"),
    BenchStep("x", "X (Twitter)"),
    BenchStep("ytmusic", "YouTube Music"),
    BenchStep("subway", "Subway Surfers"),
]

SAFARI = BenchStep("safari", "Safari")

_NAMES = {s.id: s.name for s in DEFAULT + [SAFARI]}


def name(step_id: str) -> str:
    return _NAMES.get(step_id, step_id)


def position(steps: list[BenchStep], elapsed: int) -> Optional[BenchPosition]:
    """The slot running [elapsed] ms after the start, or None with no steps."""
    if not steps:
        return None
    lengths = [max(s.minutes, 1) * MINUTE for s in steps]
    cycle = sum(lengths)
    t = max(elapsed, 0)
    rnd = t // cycle
    start = rnd * cycle
    for i, length in enumerate(lengths):
        if t < start + length:
            return BenchPosition(rnd * len(steps) + i, rnd, steps[i], start, start + length)
        start += length
    raise AssertionError("unreachable")


def report(run: ReviewRun, segments: list[BenchSegment], now: int) -> BenchReport:
    samples = sorted(run.samples, key=lambda r: r.time)
    run_end = run.ended if run.ended is not None else now
    results = [
        _segment(seg, samples, max(seg.end if seg.end is not None else run_end, seg.start))
        for seg in sorted(segments, key=lambda s: s.index)
    ]
    grouped: dict[str, list[SegmentResult]] = {}
    for r in results:
        grouped.setdefault(r.segment.step_id, []).append(r)
    apps = []
    for sid, rs in grouped.items():
        apps.append(
            AppResult(
                step_id=sid,
                name=name(sid),
                slots=len(rs),
                duration=sum(r.duration for r in rs),
                used=sum(r.used or 0 for r in rs),
                mah=sum(r.mah for r in rs) if all(r.mah is not None for r in rs) else None,
                avg_power_w=_weighted(rs, lambda r: r.avg_power_w),
                avg_temp_c=_weighted(rs, lambda r: r.avg_temp_c),
                peak_temp_c=max((r.peak_temp_c for r in rs if r.peak_temp_c is not None), default=None),
                relaunches=sum(r.segment.relaunches for r in rs),
            )
        )
    temps = [s.temp_c for s in samples if s.temp_c is not None]
    return BenchReport(
        elapsed=run_end - run.started,
        start_level=samples[0].level if samples else None,
        end_level=samples[-1].level if samples else None,
        rounds=max((s.round + 1 for s in segments), default=0),
        apps=apps,
        segments=results,
        avg_temp_c=sum(temps) / len(temps) if temps else None,
        peak_temp_c=max(temps) if temps else None,
    )


def _segment(seg: BenchSegment, s: list[Reading], end: int) -> SegmentResult:
    first = next((r for r in reversed(s) if r.time <= seg.start), None) or next(
        (r for r in s if seg.start <= r.time <= end), None
    )
    last = next((r for r in reversed(s) if r.time <= end), None)
    if last is not None and not (first is not None and last.time >= first.time):
        last = None
    inside = [r for r in s if seg.start <= r.time <= end]
    temps = [r.temp_c for r in inside if r.temp_c is not None]
    powers = [abs(r.power_w) for r in inside if r.power_w is not None]
    mah = _charge(first, last)
    if mah is None:
        mah = _integrate(s, seg.start, end)
    return SegmentResult(
        segment=seg,
        name=name(seg.step_id),
        round=seg.round,
        duration=end - seg.start,
        start_level=first.level if first else None,
        end_level=last.level if last else None,
        used=first.level - last.level if first is not None and last is not None else None,
        mah=mah,
        avg_power_w=sum(powers) / len(powers) if powers else None,
        avg_temp_c=sum(temps) / len(temps) if temps else None,
        peak_temp_c=max(temps) if temps else None,
    )


def _charge(a: Optional[Reading], b: Optional[Reading]) -> Optional[float]:
    """Charge used between two readings from the charge counter, when it moved the right way."""
    if a is None or b is None or a.charge_counter_mah is None or b.charge_counter_mah is None:
        return None
    used = a.charge_counter_mah - b.charge_counter_mah
    return used if used > 0 else None


def _integrate(s: list[Reading], start: int, end: int) -> Optional[float]:
    """Charge used from [start] to [end] by adding up current between readings no more than a minute apart."""
    mah = 0.0
    covered = 0
    for a, b in zip(s, s[1:]):
        if b.time - a.time > MINUTE or a.plugged or b.plugged:
            continue
        if a.current_ma is None or b.current_ma is None:
            continue
        overlap = min(b.time, end) - max(a.time, start)
        if overlap <= 0:
            continue
        mah += (abs(a.current_ma) + abs(b.current_ma)) / 2 * overlap / HOUR
        covered += overlap
    # Too little coverage would understate the slot.
    return mah if end > start and covered >= (end - start) * 0.8 else None


def _weighted(rs: list[SegmentResult], value: Callable[[SegmentResult], Optional[float]]) -> Optional[float]:
    with_value = [r for r in rs if value(r) is not None and r.duration > 0]
    total = sum(r.duration for r in with_value)
    if total <= 0:
        return None
    return sum(value(r) * r.duration for r in with_value) / total


# Formatting, as in Volta's Format.kt.


def _round(x: float) -> int:
    return int(math.floor(x + 0.5))


def fmt_duration(millis: int) -> str:
    minutes = int(millis // MINUTE)
    if minutes < 1:
        return "<1 min"
    if minutes < 60:
        return f"{minutes} min"
    h, m = divmod(minutes, 60)
    return f"{h // 24} d {h % 24} h" if h >= 48 else f"{h} h {m:02d} m"


def fmt_temp(celsius: float, fahrenheit: bool) -> str:
    return f"{celsius * 9 / 5 + 32:.1f} °F" if fahrenheit else f"{celsius:.1f} °C"


def fmt_watts(w: float) -> str:
    return f"{w:.1f} W"


def fmt_rate(per_hour: float) -> str:
    return f"{per_hour:.1f} pts/h"


def fmt_mah(mah: float) -> str:
    return f"{_round(mah):,} mAh"


def csv_cell(value: str) -> str:
    """Quotes a value when it contains a comma, quote or newline, and defuses spreadsheet formulas."""
    safe = "'" + value if value and value[0] in "=+-@" else value
    if any(c in safe for c in ',"\n\r'):
        return '"' + safe.replace('"', '""') + '"'
    return safe


def text(run: ReviewRun, rep: BenchReport, fahrenheit: bool = False) -> str:
    """A plain-text summary to paste into a message or post."""
    c = run.conditions
    lines = [f"Volta app benchmark · {c.phone}"]
    if c.software.strip():
        lines.append(c.software)
    lines.append(" · ".join(v for v in (c.brightness, c.refresh_rate, c.network) if v.strip()))
    lines.append("")
    levels = f" ({rep.start_level}% → {rep.end_level}%)" if rep.start_level is not None else ""
    lines.append(("Running for " if run.active else "Lasted ") + fmt_duration(rep.elapsed) + levels)
    if rep.peak_temp_c is not None:
        lines.append("Peak battery temperature " + fmt_temp(rep.peak_temp_c, fahrenheit))
    lines.append("")
    for a in rep.apps:
        parts = [
            p
            for p in (
                fmt_rate(a.per_hour) if a.per_hour is not None else None,
                fmt_mah(a.mah_per_hour) + "/h" if a.mah_per_hour is not None else None,
                fmt_watts(a.avg_power_w) if a.avg_power_w is not None else None,
                "peak " + fmt_temp(a.peak_temp_c, fahrenheit) if a.peak_temp_c is not None else None,
            )
            if p is not None
        ]
        lines.append(f"{a.name}: " + " · ".join(parts or ["under 10 min"]))
    lines.append("")
    lines.append("Recorded with Volta for iOS. Battery temperature, not surface temperature.")
    return "\n".join(lines)


def csv(run: ReviewRun, rep: BenchReport) -> str:
    """Per-app slots as CSV, one row per slot in the order they ran."""
    c = run.conditions
    out = [
        "# Volta app benchmark",
        f"# phone,{csv_cell(c.phone)}",
        f"# software,{csv_cell(c.software)}",
        f"# brightness,{csv_cell(c.brightness)}",
        f"# notes,{csv_cell(c.notes)}",
        "slot,round,app,start_ms,minutes,start_level,end_level,points_used,points_per_hour,mah_used,mah_per_hour,avg_power_w,avg_temp_c,peak_temp_c,relaunches",
    ]

    def f(v: Optional[float], spec: str) -> str:
        return "" if v is None else format(v, spec)

    for r in rep.segments:
        out.append(
            ",".join(
                [
                    str(r.segment.index + 1),
                    str(r.round + 1),
                    csv_cell(r.name),
                    str(r.segment.start),
                    f"{r.duration / MINUTE:.1f}",
                    "" if r.start_level is None else str(r.start_level),
                    "" if r.end_level is None else str(r.end_level),
                    "" if r.used is None else str(r.used),
                    f(r.per_hour, ".2f"),
                    f(r.mah, ".0f"),
                    f(r.mah_per_hour, ".0f"),
                    f(r.avg_power_w, ".2f"),
                    f(r.avg_temp_c, ".1f"),
                    f(r.peak_temp_c, ".1f"),
                    str(r.segment.relaunches),
                ]
            )
        )
    return "\n".join(out) + "\n"


def backup(run: ReviewRun, segments: list[BenchSegment]) -> str:
    """The run as a Volta backup (Lab → Import on Android), matching Json.backup in Volta."""
    c = run.conditions
    return json.dumps(
        {
            "format": BACKUP_FORMAT,
            "version": 2,
            "id": run.id,
            "started": run.started,
            "ended": run.ended,
            "conditions": {
                "phone": c.phone,
                "software": c.software,
                "protocol": c.protocol,
                "type": c.type,
                "brightness": c.brightness,
                "refreshRate": c.refresh_rate,
                "resolution": c.resolution,
                "network": c.network,
                "performance": c.performance,
                "charger": c.charger,
                "notes": c.notes,
                "reviewRecording": c.review_recording,
            },
            "samples": [
                [r.time, r.level, 1 if r.plugged else 0, r.temp_c, r.voltage_v, r.current_ma, r.charge_counter_mah]
                for r in sorted(run.samples, key=lambda r: r.time)
            ],
            "segments": [
                {"index": s.index, "round": s.round, "step": s.step_id, "start": s.start, "end": s.end, "relaunches": s.relaunches}
                for s in segments
            ],
        }
    )


def segments_from_events(events: list[dict], run_end: Optional[int]) -> list[BenchSegment]:
    """Slots from the runner's events. A slot ends when the next one starts, or when the run ends.
    A runner picking a slot back up after a restart sends its start again; the first one counts."""
    starts: dict[int, dict] = {}
    relaunches: dict[int, int] = {}
    for e in events:
        if e.get("kind") == "slot":
            starts.setdefault(int(e["index"]), e)
        elif e.get("kind") == "relaunch":
            i = int(e["index"])
            relaunches[i] = relaunches.get(i, 0) + 1
    ordered = sorted(starts.items())
    out = []
    for n, (i, e) in enumerate(ordered):
        end = ordered[n + 1][1]["time"] if n + 1 < len(ordered) else run_end
        start = int(e["time"])
        out.append(BenchSegment(i, int(e["round"]), str(e["step"]), start, None if end is None else max(int(end), start), relaunches.get(i, 0)))
    return out


def _signed64(v: int) -> int:
    # The battery registry reports some negative values as unsigned 64-bit integers.
    return v - (1 << 64) if v >= (1 << 63) else v


def reading_from_battery(d: dict, time: int) -> Optional[Reading]:
    """A reading from the iPhone's IOPMPowerSource registry entry (pymobiledevice3 diagnostics battery single)."""
    cur = d.get("CurrentCapacity")
    if cur is None:
        return None
    max_cap = d.get("MaxCapacity") or 100
    level = int(cur) if max_cap == 100 else _round(int(cur) * 100 / int(max_cap))
    plugged = bool(d.get("ExternalConnected"))
    charging = bool(d.get("IsCharging"))
    temp = d.get("Temperature")
    volt = d.get("Voltage") or d.get("AppleRawBatteryVoltage")
    amp = d.get("InstantAmperage", d.get("Amperage"))
    current = None
    if amp is not None:
        a = abs(_signed64(int(amp)))
        # Volta's convention: positive while charging, negative while discharging.
        current = a if charging else -a if not plugged else _signed64(int(amp))
    counter = d.get("AppleRawCurrentCapacity")
    return Reading(
        time=time,
        level=max(0, min(100, level)),
        plugged=plugged,
        temp_c=None if temp is None else _signed64(int(temp)) / 100,
        voltage_v=None if not volt else int(volt) / 1000,
        current_ma=current,
        charge_counter_mah=None if counter is None else float(counter),
    )
