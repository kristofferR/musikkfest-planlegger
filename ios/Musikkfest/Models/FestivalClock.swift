import Foundation

/// Derives the festival lifecycle state and the current position on the
/// continuous festival-minute scale (shared with `Event.startMinutes`).
///
/// Festival day: 2026-06-06 (Oslo). Live from 10:00; "over" at 2026-06-07 06:00,
/// matching the web `FESTIVAL_OVER_AT`.
struct FestivalClock {
    enum Mode: Equatable { case before, live, after }

    static let timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
    static let liveStartMinutes = 10 * 60          // 10:00
    static let overMinutes = 30 * 60               // 2026-06-07 06:00 (30h after festival midnight)
    static let lastSlotMinutes = 26 * 60           // 02:00 next day

    /// "Now" instant.
    let now: Date
    /// DEBUG-only override of the festival-minute position (set via `?now=HH:MM`).
    var overrideMinutes: Int?

    init(now: Date = Date(), overrideMinutes: Int? = nil) {
        self.now = now
        self.overrideMinutes = overrideMinutes
    }

    private static let festivalMidnight: Date = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.date(from: DateComponents(year: 2026, month: 6, day: 6, hour: 0, minute: 0)) ?? Date()
    }()

    /// Minutes from festival-day midnight (Oslo) to `now`, continuous across midnight.
    var realMinutes: Int {
        Int(now.timeIntervalSince(Self.festivalMidnight) / 60)
    }

    /// The festival-minute position used by the UI (honours the debug override).
    var nowMinutes: Int { overrideMinutes ?? realMinutes }

    var mode: Mode {
        let m = nowMinutes
        if m < Self.liveStartMinutes { return .before }
        if m >= Self.overMinutes { return .after }
        return .live
    }

    var isLive: Bool { mode == .live }

    /// "HH:MM" label for the now-line.
    var nowLabel: String {
        let total = ((nowMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
        return String(format: "%02d:%02d", total / 60, total % 60)
    }

    /// Whole minutes until the festival starts (for the pre-festival countdown).
    var minutesUntilStart: Int { max(0, Self.liveStartMinutes - nowMinutes) }

    /// A friendly Norwegian countdown string for the pre-festival state.
    var countdownText: String {
        let days = Int(Self.festivalMidnight.addingTimeInterval(Double(Self.liveStartMinutes) * 60)
            .timeIntervalSince(now) / 86_400)
        if days >= 2 { return "Om \(days) dager" }
        let mins = minutesUntilStart
        if mins >= 60 { return "Om \(mins / 60) t \(mins % 60) min" }
        if mins > 0 { return "Om \(mins) min" }
        return "Snart"
    }
}
