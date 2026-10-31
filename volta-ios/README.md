# Volta app benchmark for iPhone

The iPhone version of [Volta](https://github.com/alexmaxham/Volta)'s app benchmark. It runs the same apps on the same schedule as on Android (Chrome, YouTube, Instagram, 4K60 camera recording, TikTok, X, YouTube Music and Subway Surfers, an hour each, on repeat until the battery reaches 3%). It works out the results with the same maths, so Android and iPhone results can be compared directly.

## How it differs from Android

iOS doesn't let an app control other apps or read its own battery current and temperature. So a **Mac runs the benchmark**:

- **Driving the apps:** an Xcode UI test (`Runner/`) runs on the phone. It opens each app on schedule and scrolls, swipes and taps in it the way Volta's accessibility service does. If something else takes over the screen, it brings the app back.
- **Recording the battery:** `mac/volta_bench.py` reads the phone's battery every 15 seconds over Wi-Fi with [pymobiledevice3](https://github.com/doronz88/pymobiledevice3). It reads level, current, voltage, temperature and remaining mAh, which is more than Android reports on most phones.
- **Results:** shown on the Mac as text and CSV, plus a Volta backup file. Open that file in Volta on Android (**Lab → Import**) to see the iPhone run next to your Android runs.

The phone must be connected to the Mac **over Wi-Fi, not a cable**, or it charges during the test.

## What you need

- A Mac with Xcode 16 or later, and Homebrew
- An Apple developer account (a free one works, but its apps expire after 7 days). You need your **Team ID** from Xcode → Settings → Accounts.
- An iPhone on iOS 17 or later, with Developer Mode on (Settings → Privacy & Security → Developer Mode)
- The apps you want to test, installed, signed in and past their first-run screens

## Setup (once)

```bash
brew install xcodegen
cd volta-ios
python3 -m venv .venv && source .venv/bin/activate
pip install -r mac/requirements.txt
```

1. Plug the phone into the Mac once and tap **Trust**.
2. In Xcode → Window → Devices and Simulators, select the phone and tick **Connect via network**. Unplug it; it should still show with a globe icon.
3. Check that the Mac can read the battery over Wi-Fi:

   ```bash
   python3 mac/volta_bench.py check
   ```

   You should see something like `Battery: 100% · on battery · -412 mA · -1.65 W · 30.8 °C · 3210 mAh left`, followed by the apps that are installed. If the phone isn't found over Wi-Fi, try `python3 mac/volta_bench.py --pmd3-args=--mobdev2 check`, and use that option on every command.

If `check` shows a level but no current or temperature, the benchmark still runs, but results only show points per hour, like Volta on phones without a current sensor.

## Running a benchmark

```bash
python3 mac/volta_bench.py run --team ABCDE12345
```

The command:

1. Checks the phone and leaves out apps that aren't installed.
2. Shows the checklist: Auto-Brightness, True Tone and Night Shift off; 200 nits measured with a lux meter; Auto-Lock **Never**; Low Power Mode off; Focus on; Camera set to 4K 60 fps with about 25 GB free; and the phone at 100% and unplugged.
3. Builds and installs the runner. On the first run, trust the developer on the phone under Settings → General → VPN & Device Management.
4. Drives the apps and records the battery until the phone reaches 3%, a charger is connected, or you press **Ctrl+C**.

The Mac stays awake while the run goes. If the runner stops (for example, Wi-Fi drops), the Mac starts it again, and it picks up the app the schedule says it should be in.

While a run is going, from another Terminal:

```bash
python3 mac/volta_bench.py report        # results so far for the latest run
python3 mac/volta_bench.py list
```

Each run is saved in `runs/<id>/`: `results.txt`, `results.csv`, `volta-backup.json`, plus the raw readings, runner events and the Xcode log.

### Options

| Option | Default | |
|---|---|---|
| `--apps chrome,youtube,…` | all eight | Which apps, in order: `chrome`, `youtube`, `instagram`, `camera`, `tiktok`, `x`, `ytmusic`, `subway` |
| `--minutes 60` | 60 | Minutes in each app |
| `--browser safari` | chrome | Use Safari for the web step |
| `--link youtube=https://…` | search | A video to play; `ytmusic=https://music.youtube.com/playlist?list=…` for a playlist |
| `--bundle-prefix com.you` | com.alexmaxham | Bundle ID prefix, if the default is taken on your team |
| `--phone "iPhone 17 Pro"` | the phone's name | Name in the results |
| `--wait-for-idle` | off | Let XCTest wait for each app to stop animating before every gesture |
| `--udid …` (before `run`) | the connected phone | Which phone, when several are connected |

`VOLTA_TEAM`, `VOLTA_UDID` and `VOLTA_BUNDLE_PREFIX` can be set in the environment instead.

## What each app does

The same as on Android, with the iPhone's equivalents:

- **Chrome / Safari:** opens the same 8 web pages in turn and scrolls each for about a minute. Each page opens in a new tab.
- **YouTube:** plays your `--link`, or the first result for "4K nature documentary 1 hour".
- **Instagram:** scrolls the home feed every 5 seconds.
- **Camera:** switches to Video and records for the hour. Set 4K 60 fps in Settings → Camera → Record Video first.
- **TikTok:** swipes to the next video every 10 seconds.
- **X:** scrolls the home timeline every 6 seconds.
- **YouTube Music:** plays your playlist `--link`, or the top result for "Today's top hits". A playlist link is more reliable.
- **Subway Surfers:** plays with swipes and taps every second or so.

## Notes

- The temperature is the battery's, not the surface's, as in Volta.
- XCTest normally waits for an app to stop animating before each gesture, which can take seconds in video apps and games. The runner turns that wait off, the same way WebDriverAgent (Appium) does. `--wait-for-idle` turns it back on.
- Taps that look for a button (the camera's record button, YouTube Music's Play) fall back to a fixed screen position when an app update renames the button.
- None of this can go on the App Store. It's a test tool installed from your own Mac.

## Project layout

- `project.yml`: the Xcode project, generated with XcodeGen (`VoltaBench.xcodeproj` is not committed)
- `App/`: a small host app that the UI test runs alongside. It shows the battery level.
- `Runner/`: the UI test that drives the apps (`AppBenchmark.swift`), what it does in each app (`Workloads.swift`), and the schedule (`Plan.swift`)
- `mac/benchmark.py`: Volta's `core/Benchmark.kt` ported to Python (schedule, per-app results, text, CSV, Volta backup), with its tests ported in `test_benchmark.py`
- `mac/volta_bench.py`: the command that builds, runs and records

```bash
python3 -m unittest discover -s mac   # tests
```

Every push that touches `volta-ios/` runs the tests and compiles the runner on GitHub Actions (`.github/workflows/volta-ios.yml`).
