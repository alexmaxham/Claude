import Foundation

/// One app in the benchmark loop, as in Volta's core/Benchmark.kt. `link` is optional content to open, such as a video or playlist.
struct BenchStep: Codable, Equatable {
    var id: String
    var name: String
    var minutes: Int
    var link: String
}

/// Where the loop is: the `index`th app slot overall, in `round` (from 0), and when that slot starts and ends, relative to the run start.
struct BenchPosition: Equatable {
    let index: Int
    let round: Int
    let step: BenchStep
    let start: Int64
    let end: Int64
}

enum Time {
    static let second: Int64 = 1000
    static let minute: Int64 = 60 * second

    static func now() -> Int64 { Int64((Date().timeIntervalSince1970 * 1000).rounded()) }
}

enum Schedule {
    /// The slot running `elapsed` ms after the start, or nil with no steps. The same as `Benchmark.position` in Volta.
    static func position(_ steps: [BenchStep], elapsed: Int64) -> BenchPosition? {
        guard !steps.isEmpty else { return nil }
        let lengths = steps.map { Int64(max($0.minutes, 1)) * Time.minute }
        let cycle = lengths.reduce(0, +)
        let t = max(elapsed, 0)
        let round = Int(t / cycle)
        var start = Int64(round) * cycle
        for (i, length) in lengths.enumerated() {
            if t < start + length {
                return BenchPosition(index: round * steps.count + i, round: round, step: steps[i], start: start, end: start + length)
            }
            start += length
        }
        return nil
    }
}

/// The run, as the Mac passes it in (volta_bench.py sets TEST_RUNNER_VOLTA_* for xcodebuild).
/// The schedule follows from the start time alone, so a runner started again mid-run picks up where it should be.
struct RunConfig {
    let runId: String
    let started: Int64
    let steps: [BenchStep]
    let stopLevel: Int
    let waitForIdle: Bool

    static func fromEnvironment(_ env: [String: String] = ProcessInfo.processInfo.environment) -> RunConfig? {
        guard let runId = env["VOLTA_RUN_ID"],
              let started = env["VOLTA_STARTED"].flatMap({ Int64($0) }),
              let data = env["VOLTA_STEPS"].flatMap({ Data(base64Encoded: $0) }),
              let steps = try? JSONDecoder().decode([BenchStep].self, from: data)
        else { return nil }
        return RunConfig(
            runId: runId,
            started: started,
            steps: steps,
            stopLevel: env["VOLTA_STOP_LEVEL"].flatMap { Int($0) } ?? 3,
            waitForIdle: env["VOLTA_WAIT_FOR_IDLE"] == "1"
        )
    }
}

/// Lines the Mac reads from xcodebuild's output: `VOLTA|{json}`.
enum Events {
    static func emit(_ kind: String, _ fields: [String: Any] = [:]) {
        var o = fields
        o["kind"] = kind
        o["time"] = Time.now()
        guard let data = try? JSONSerialization.data(withJSONObject: o, options: [.sortedKeys]),
              let line = String(data: data, encoding: .utf8) else { return }
        print("VOLTA|" + line)
        fflush(stdout)
    }
}
