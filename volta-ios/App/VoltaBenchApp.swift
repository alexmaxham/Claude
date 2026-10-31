import SwiftUI

/// The app the UI test runner is attached to. Runs are started and recorded from the Mac; this only
/// shows the battery so you can check the phone is ready.
@main
struct VoltaBenchApp: App {
    var body: some Scene {
        WindowGroup { ReadyView() }
    }
}

struct ReadyView: View {
    @State private var level: Float = -1
    @State private var state: UIDevice.BatteryState = .unknown
    private let timer = Timer.publish(every: 5, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Volta Bench").font(.largeTitle.bold())
            Text(level >= 0 ? "\(Int((level * 100).rounded()))% · \(stateText)" : "Battery level unavailable")
                .font(.title2.monospacedDigit())
            Text("Start the app benchmark from your Mac:\n\npython3 mac/volta_bench.py run --team YOUR_TEAM_ID\n\nThe Mac opens and drives each app on this phone and records the battery over Wi-Fi.")
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear {
            UIDevice.current.isBatteryMonitoringEnabled = true
            read()
        }
        .onReceive(timer) { _ in read() }
    }

    private var stateText: String {
        switch state {
        case .charging: "charging"
        case .full: "full"
        case .unplugged: "on battery"
        default: "unknown"
        }
    }

    private func read() {
        level = UIDevice.current.batteryLevel
        state = UIDevice.current.batteryState
    }
}
