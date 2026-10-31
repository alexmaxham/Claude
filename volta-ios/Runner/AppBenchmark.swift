import ObjectiveC
import XCTest

/// Runs Volta's app benchmark on the iPhone. As a UI test it can open each app on schedule, scroll,
/// swipe and tap inside it, and see which app is in front. The battery is recorded by the Mac
/// (volta_bench.py), which also starts this test and starts it again if it stops early.
final class AppBenchmark: XCTestCase {
    override func setUp() {
        continueAfterFailure = true
    }

    @MainActor
    func testAppBenchmark() throws {
        guard let config = RunConfig.fromEnvironment() else {
            throw XCTSkip("Start runs from the Mac with `python3 mac/volta_bench.py run`; it passes the plan in.")
        }
        if !config.waitForIdle { Quiescence.skipWaits() }
        Runner(config).drive()
    }
}

@MainActor
final class Runner {
    private let config: RunConfig
    private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    private static let tick: TimeInterval = 0.5

    /// Time for an app to open before the first move.
    private static let openWait: Int64 = 5_000
    private static let startGap: Int64 = 2_500

    /// How long another app may stay in front before the step's app is opened again.
    private static let awayLimit: Int64 = 15_000

    init(_ config: RunConfig) {
        self.config = config
    }

    func drive() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        Events.emit("runner", ["run": config.runId])
        var work: Workload?
        var opened = -1
        var queue: [Move] = []
        var loopAt = 0
        var nextMove: Int64 = 0
        var awaySince: Int64 = 0
        var nextBattery: Int64 = 0

        while true {
            let now = Time.now()
            guard let pos = Schedule.position(config.steps, elapsed: now - config.started) else { return }

            if opened != pos.index {
                if let w = work {
                    if w.app.state == .runningForeground { perform(w.leave, in: w) }
                    XCUIDevice.shared.press(.home)
                    Thread.sleep(forTimeInterval: 1.5)
                }
                Events.emit("slot", ["index": pos.index, "round": pos.round, "step": pos.step.id])
                work = Workloads.of(pos.step)
                if let w = work { open(w) } else { Events.emit("missing", ["message": "This runner can't drive \(pos.step.name)."]) }
                opened = pos.index
                queue = work?.start ?? []
                loopAt = 0
                nextMove = Time.now() + Self.openWait
                awaySince = 0
            }

            if let w = work {
                let front = w.app.state == .runningForeground
                if front {
                    awaySince = 0
                } else if awaySince == 0 {
                    awaySince = now
                } else if now - awaySince > Self.awayLimit {
                    open(w)
                    queue = w.start
                    nextMove = Time.now() + Self.openWait
                    awaySince = 0
                    Events.emit("relaunch", ["index": pos.index, "step": pos.step.id])
                }
                if now >= nextMove && front {
                    if !queue.isEmpty {
                        perform([queue.removeFirst()], in: w)
                        nextMove = Time.now() + Self.startGap
                    } else if !w.loop.isEmpty {
                        perform([w.loop[loopAt % w.loop.count]], in: w)
                        loopAt += 1
                        nextMove = now + w.every
                    }
                }
            }

            // The Mac watches the battery too, with more detail; this catches the end if the Mac loses the phone.
            if now >= nextBattery {
                nextBattery = now + 15 * Time.second
                let device = UIDevice.current
                let level = device.batteryLevel >= 0 ? Int((device.batteryLevel * 100).rounded()) : nil
                var reason: String?
                if device.batteryState == .charging || device.batteryState == .full {
                    reason = "The charger was connected"
                } else if let level, level <= config.stopLevel {
                    reason = "The battery reached \(level)%"
                }
                if let reason {
                    if let w = work, w.app.state == .runningForeground { perform(w.leave, in: w) }
                    XCUIDevice.shared.press(.home)
                    Events.emit("end", ["reason": reason])
                    return
                }
            }
            Thread.sleep(forTimeInterval: Self.tick)
        }
    }

    private func open(_ w: Workload) {
        switch w.open {
        case .activate:
            w.app.activate()
        case .url(let url):
            openURL(url)
        }
    }

    /// Opens a link with the app it belongs to, confirming the system's "Open in …?" prompt if one shows.
    private func openURL(_ url: URL) {
        XCUIDevice.shared.system.open(url)
        let confirm = springboard.buttons["Open"]
        if confirm.waitForExistence(timeout: 2) { confirm.tap() }
    }

    private func perform(_ moves: [Move], in w: Workload) {
        for (i, m) in moves.enumerated() {
            if i > 0 { Thread.sleep(forTimeInterval: TimeInterval(Self.startGap) / 1000) }
            switch m {
            case let .swipe(x1, y1, x2, y2, ms):
                swipe(w.app, x1, y1, x2, y2, ms: ms)
            case let .tap(x, y):
                point(w.app, x, y).tap()
            case let .tapLabel(words, x, y, avoid, exact):
                if let e = find(w.app, words: words, avoid: avoid, exact: exact) { e.tap() } else { point(w.app, x, y).tap() }
            case let .open(url):
                openURL(url)
            }
        }
    }

    private func point(_ app: XCUIApplication, _ x: CGFloat, _ y: CGFloat) -> XCUICoordinate {
        app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y))
    }

    private lazy var screen: CGSize = springboard.frame.size

    /// A drag between two points given as fractions of the screen, taking about `ms` milliseconds.
    private func swipe(_ app: XCUIApplication, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, ms: Int) {
        let distance = hypot((x2 - x1) * screen.width, (y2 - y1) * screen.height)
        let speed = distance / (CGFloat(max(ms, 50)) / 1000)
        point(app, x1, y1).press(forDuration: 0.02, thenDragTo: point(app, x2, y2), withVelocity: XCUIGestureVelocity(speed), thenHoldForDuration: 0)
    }

    /// The first visible control labelled with one of `words`, trying each word in turn.
    private func find(_ app: XCUIApplication, words: [String], avoid: [String], exact: Bool) -> XCUIElement? {
        for word in words {
            let p = exact
                ? NSPredicate(format: "label ==[c] %@ OR identifier ==[c] %@", word, word)
                : NSPredicate(format: "label CONTAINS[c] %@ OR identifier CONTAINS[c] %@", word, word)
            for query in [app.buttons, app.descendants(matching: .any)] {
                for e in query.matching(p).allElementsBoundByIndex.prefix(20) where e.exists && e.isHittable {
                    let label = (e.label + " " + e.identifier).lowercased()
                    if !avoid.contains(where: { label.contains($0) }) { return e }
                }
            }
        }
        return nil
    }
}

/// XCTest waits for an app to stop animating before every gesture, which in video apps and games
/// can take many seconds and throw off the timing. Volta's runner on Android doesn't wait, so this
/// turns the wait off, the same way WebDriverAgent does. Pass --wait-for-idle to keep it.
@MainActor
enum Quiescence {
    static func skipWaits() {
        guard let cls = NSClassFromString("XCUIApplicationProcess") else { return }
        let one: @convention(block) (AnyObject, Bool) -> Void = { _, _ in }
        let two: @convention(block) (AnyObject, Bool, Bool) -> Void = { _, _, _ in }
        if let m = class_getInstanceMethod(cls, NSSelectorFromString("waitForQuiescenceIncludingAnimationsIdle:")) {
            method_setImplementation(m, imp_implementationWithBlock(one))
        }
        if let m = class_getInstanceMethod(cls, NSSelectorFromString("waitForQuiescenceIncludingAnimationsIdle:isPreEvent:")) {
            method_setImplementation(m, imp_implementationWithBlock(two))
        }
    }
}
