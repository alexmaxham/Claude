"""Volta's BenchmarkTest (core/src/test/.../CoreTest.kt), ported, plus the iPhone-specific parts.
Run with: python3 -m unittest discover -s volta-ios/mac"""

import json
import unittest

import benchmark as b
from benchmark import HOUR as H, MINUTE as M, BenchSegment, BenchStep, Conditions, Reading, ReviewRun


def r(minute, level, plugged=False, temp_c=None, current_ma=None, voltage=None, counter=None):
    return Reading(minute * M, level, plugged, temp_c, voltage, current_ma, counter)


class BenchmarkTest(unittest.TestCase):
    steps = [BenchStep("a", "A"), BenchStep("b", "B"), BenchStep("c", "C", minutes=30)]

    def test_position_walks_steps_then_repeats(self):
        p0 = b.position(self.steps, 0)
        self.assertEqual("a", p0.step.id)
        self.assertEqual(0, p0.index)
        self.assertEqual(H, p0.end)

        p1 = b.position(self.steps, 90 * M)
        self.assertEqual("b", p1.step.id)
        self.assertEqual(1, p1.index)
        self.assertEqual(H, p1.start)

        p2 = b.position(self.steps, 2 * H + 29 * M)
        self.assertEqual("c", p2.step.id)
        self.assertEqual(2 * H + 30 * M, p2.end)

        # The loop is 2.5 h long, so 2.5 h in starts round two with the first app again.
        again = b.position(self.steps, 2 * H + 30 * M)
        self.assertEqual("a", again.step.id)
        self.assertEqual(1, again.round)
        self.assertEqual(3, again.index)
        self.assertEqual(2 * H + 30 * M, again.start)

    def test_position_needs_steps(self):
        self.assertIsNone(b.position([], 0))

    def test_report_splits_drain_by_app(self):
        samples = [
            r(m, 100 - m // 6 if m <= 60 else 90 - (m - 60) // 4, temp_c=30 + m / 60, current_ma=-500 if m <= 60 else -900, voltage=4.0)
            for m in range(121)
        ]
        run = ReviewRun("x", 0, 120 * M, Conditions(phone="Test"), samples)
        segs = [BenchSegment(0, 0, "chrome", 0, 60 * M), BenchSegment(1, 0, "youtube", 60 * M, 120 * M, relaunches=2)]
        rep = b.report(run, segs, 120 * M)

        self.assertEqual(2, len(rep.apps))
        chrome = next(a for a in rep.apps if a.step_id == "chrome")
        self.assertEqual(10, chrome.used)
        self.assertAlmostEqual(10.0, chrome.per_hour, delta=0.01)
        self.assertAlmostEqual(500.0, chrome.mah_per_hour, delta=1.0)
        self.assertAlmostEqual(2.0, chrome.avg_power_w, delta=0.01)

        yt = next(a for a in rep.apps if a.step_id == "youtube")
        self.assertEqual(15, yt.used)
        # The first minute averages the two currents at the boundary.
        self.assertAlmostEqual(900.0, yt.mah_per_hour, delta=5.0)
        self.assertEqual(2, yt.relaunches)
        self.assertEqual(1, rep.rounds)
        self.assertEqual(100, rep.start_level)
        self.assertEqual(75, rep.end_level)

    def test_report_prefers_the_charge_counter(self):
        samples = [r(m, 100 - m // 10, current_ma=-100, counter=4000.0 - m * 10) for m in range(61)]
        run = ReviewRun("x", 0, 60 * M, Conditions(), samples)
        rep = b.report(run, [BenchSegment(0, 0, "chrome", 0, 60 * M)], 60 * M)
        self.assertAlmostEqual(600.0, rep.apps[0].mah, delta=0.1)

    def test_short_or_gappy_slots_have_no_rate(self):
        samples = [r(0, 100, current_ma=-500), r(5, 99, current_ma=-500), r(40, 95, current_ma=-500)]
        run = ReviewRun("x", 0, 40 * M, Conditions(), samples)
        rep = b.report(run, [BenchSegment(0, 0, "chrome", 0, 5 * M), BenchSegment(1, 0, "youtube", 5 * M, 40 * M)], 40 * M)
        self.assertIsNone(rep.segments[0].per_hour)
        # 35 minutes with a 35-minute gap between readings: no current-based charge.
        self.assertIsNone(rep.segments[1].mah)
        self.assertEqual(4, rep.segments[1].used)

    def test_csv_has_one_row_per_slot(self):
        samples = [r(m, 100 - m // 10) for m in range(61)]
        run = ReviewRun("x", 0, 60 * M, Conditions(phone="Pixel, 9"), samples)
        rep = b.report(run, [BenchSegment(0, 0, "chrome", 0, 30 * M), BenchSegment(1, 0, "youtube", 30 * M, 60 * M)], 60 * M)
        lines = [l for l in b.csv(run, rep).splitlines() if l.strip()]
        self.assertIn('# phone,"Pixel, 9"', lines)
        self.assertEqual(2, sum(1 for l in lines if not l.startswith("#") and not l.startswith("slot,")))
        self.assertIn("Chrome: 6.0 pts/h", b.text(run, rep))


class IphoneTest(unittest.TestCase):
    def test_segments_from_events(self):
        events = [
            {"kind": "slot", "index": 0, "round": 0, "step": "chrome", "time": 1000},
            {"kind": "relaunch", "index": 0, "time": 5000},
            # A restarted runner picks the same slot back up: the first start counts.
            {"kind": "slot", "index": 0, "round": 0, "step": "chrome", "time": 9000},
            {"kind": "slot", "index": 1, "round": 0, "step": "youtube", "time": 60000},
        ]
        segs = b.segments_from_events(events, 90000)
        self.assertEqual([BenchSegment(0, 0, "chrome", 1000, 60000, 1), BenchSegment(1, 0, "youtube", 60000, 90000, 0)], segs)
        self.assertIsNone(b.segments_from_events(events, None)[-1].end)

    def test_reading_from_battery_registry(self):
        d = {
            "CurrentCapacity": 87,
            "MaxCapacity": 100,
            "ExternalConnected": False,
            "IsCharging": False,
            "Temperature": 3150,
            "Voltage": 4012,
            "InstantAmperage": (1 << 64) - 640,
            "AppleRawCurrentCapacity": 3021,
        }
        x = b.reading_from_battery(d, 42)
        self.assertEqual(Reading(42, 87, False, 31.5, 4.012, -640, 3021.0), x)
        self.assertAlmostEqual(-2.568, x.power_w, places=3)

        charging = b.reading_from_battery({**d, "ExternalConnected": True, "IsCharging": True, "InstantAmperage": 1500}, 43)
        self.assertEqual(1500, charging.current_ma)
        self.assertTrue(charging.plugged)
        self.assertIsNone(b.reading_from_battery({}, 0))

    def test_backup_matches_volta_format(self):
        run = ReviewRun("id1", 0, 60 * M, Conditions(phone="iPhone", protocol=b.PROTOCOL), [r(0, 100, current_ma=-500, voltage=4.0)])
        o = json.loads(b.backup(run, [BenchSegment(0, 0, "chrome", 0, 60 * M)]))
        self.assertEqual("volta-review-run", o["format"])
        self.assertEqual(2, o["version"])
        self.assertEqual("App benchmark", o["conditions"]["protocol"])
        self.assertEqual([0, 100, 0, None, 4.0, -500, None], o["samples"][0])
        self.assertEqual({"index": 0, "round": 0, "step": "chrome", "start": 0, "end": 60 * M, "relaunches": 0}, o["segments"][0])


if __name__ == "__main__":
    unittest.main()
