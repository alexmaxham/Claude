import XCTest

/// Something the runner does inside an app. Positions are fractions of the screen.
enum Move {
    case swipe(x1: CGFloat, y1: CGFloat, x2: CGFloat, y2: CGFloat, ms: Int)

    case tap(x: CGFloat, y: CGFloat)

    /// Taps the first control whose label or identifier contains one of `words` (in order of preference), or `x`, `y` if none does.
    /// With `exact`, the label has to be the word itself.
    case tapLabel(words: [String], x: CGFloat, y: CGFloat, avoid: [String], exact: Bool)

    /// Opens `url` in the step's app, replacing what it showed.
    case open(URL)

    static func label(_ words: [String], _ x: CGFloat, _ y: CGFloat, avoid: [String] = [], exact: Bool = false) -> Move {
        .tapLabel(words: words, x: x, y: y, avoid: avoid, exact: exact)
    }
}

/// How the runner opens an app: bring it to the front, or hand the system a link that opens in it.
enum Opening {
    case activate
    case url(URL)
}

/// How the runner drives one app: how to open it, a few `start` moves once it's open, then `loop`
/// moves one at a time every `every` ms, and `leave` moves before switching to the next app.
struct Workload {
    let app: XCUIApplication
    let open: Opening
    var start: [Move] = []
    var loop: [Move] = []
    var every: Int64 = 0
    var leave: [Move] = []
}

/// The iPhone versions of the apps in Volta's Workloads.kt, driven the same way.
@MainActor
enum Workloads {
    static let chrome = "com.google.chrome.ios"
    static let safari = "com.apple.mobilesafari"
    static let youtube = "com.google.ios.youtube"
    static let instagram = "com.burbn.instagram"
    static let camera = "com.apple.camera"
    static let tiktok = "com.zhiliaoapp.musically"
    static let x = "com.atebits.Tweetie2"
    static let ytMusic = "com.google.ios.youtubemusic"
    static let subway = "com.kiloo.subwaysurfers"

    /// The same pages every run, and the same as on Android, so results compare between phones. The browser reads each for about a minute.
    static let pages = [
        "https://en.wikipedia.org/wiki/Lithium-ion_battery",
        "https://www.bbc.com/news",
        "https://www.theverge.com",
        "https://en.wikipedia.org/wiki/Android_(operating_system)",
        "https://github.com/trending",
        "https://www.espn.com",
        "https://en.wikipedia.org/wiki/Smartphone",
        "https://www.imdb.com/chart/top/",
    ]

    static let youtubeSearch = "4K nature documentary 1 hour"
    static let musicSearch = "Today's top hits"

    /// A short scroll through a feed, and a full-page swipe for one-video-at-a-time apps.
    static let scroll = Move.swipe(x1: 0.5, y1: 0.72, x2: 0.5, y2: 0.32, ms: 350)
    static let nextVideo = Move.swipe(x1: 0.5, y1: 0.8, x2: 0.5, y2: 0.2, ms: 250)

    static let record = ["record video", "start recording", "videocapture", "record", "shutter"]
    static let stop = ["stop recording", "stop video", "videocapture", "stop"]

    /// How to run `step`, or nil for a step this runner doesn't know.
    static func of(_ step: BenchStep) -> Workload? {
        let link = step.link.trimmingCharacters(in: .whitespaces).hasPrefix("https://") ? step.link.trimmingCharacters(in: .whitespaces) : nil
        switch step.id {
        case "chrome", "safari":
            let chrome = step.id == "chrome"
            func page(_ s: String) -> URL { chrome ? chromeURL(s) : URL(string: s)! }
            let rest = Array(pages.dropFirst()) + [pages[0]]
            return Workload(
                app: XCUIApplication(bundleIdentifier: chrome ? self.chrome : safari),
                open: .url(page(pages[0])),
                // About a minute a page: nine scrolls six seconds apart, then the next page.
                loop: rest.flatMap { Array(repeating: scroll, count: 9) + [.open(page($0))] },
                every: 6_000
            )
        case "youtube":
            let target = link.map(appLink(scheme: "youtube")) ?? URL(string: "youtube://www.youtube.com/results?search_query=" + escape(youtubeSearch))!
            return Workload(
                app: XCUIApplication(bundleIdentifier: youtube),
                open: .url(target),
                // The first search result; a chosen video plays on its own.
                start: link == nil ? [.tap(x: 0.5, y: 0.3)] : []
            )
        case "instagram":
            return Workload(app: XCUIApplication(bundleIdentifier: instagram), open: .activate, loop: [scroll], every: 5_000)
        case "camera":
            return Workload(
                app: XCUIApplication(bundleIdentifier: camera),
                open: .activate,
                start: [.label(["video"], 0.5, 0.78, exact: true), .label(record, 0.5, 0.87, avoid: ["stop", "settings", "timer", "mode"])],
                leave: [.label(stop, 0.5, 0.87)]
            )
        case "tiktok":
            return Workload(app: XCUIApplication(bundleIdentifier: tiktok), open: .activate, loop: [nextVideo], every: 10_000)
        case "x":
            return Workload(app: XCUIApplication(bundleIdentifier: x), open: .activate, loop: [scroll], every: 6_000)
        case "ytmusic":
            let target = link.map(appLink(scheme: "youtubemusic")) ?? URL(string: "youtubemusic://music.youtube.com/search?q=" + escape(musicSearch))!
            return Workload(
                app: XCUIApplication(bundleIdentifier: ytMusic),
                open: .url(target),
                // A playlist link shows its page; search shows results. Either way, start playing the first thing on it.
                start: [.label(["shuffle", "play all", "play"], 0.5, 0.3, avoid: ["playlist", "player"])]
            )
        case "subway":
            return Workload(
                app: XCUIApplication(bundleIdentifier: subway),
                open: .activate,
                // A tap starts a run or dismisses the end screen; swipes dodge left, right, up and down.
                start: [.tap(x: 0.5, y: 0.6)],
                loop: [
                    .swipe(x1: 0.65, y1: 0.6, x2: 0.3, y2: 0.6, ms: 120),
                    .swipe(x1: 0.5, y1: 0.65, x2: 0.5, y2: 0.35, ms: 120),
                    .swipe(x1: 0.35, y1: 0.6, x2: 0.7, y2: 0.6, ms: 120),
                    .swipe(x1: 0.5, y1: 0.4, x2: 0.5, y2: 0.7, ms: 120),
                    .tap(x: 0.5, y: 0.6),
                ],
                every: 1_200
            )
        default:
            return nil
        }
    }

    /// Chrome's own scheme opens a page in Chrome whatever the default browser is.
    static func chromeURL(_ https: String) -> URL {
        URL(string: "googlechromes://" + https.dropFirst("https://".count))!
    }

    /// An https link to the same page through the app's scheme, so it opens in the app rather than the browser.
    static func appLink(scheme: String) -> (String) -> URL {
        { https in URL(string: scheme + "://" + https.dropFirst("https://".count)) ?? URL(string: https)! }
    }

    static func escape(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&+=?'"))) ?? s
    }
}
