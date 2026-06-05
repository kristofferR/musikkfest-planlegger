import SwiftUI

/// Lightweight typography tokens. The web uses DM Sans / DM Mono; on iOS we use
/// the system font (full Dynamic Type support) with a monospaced design for the
/// numeric/label runs the web sets in DM Mono (times, counts, kickers).
enum Typography {
    static let screenTitle = Font.title2.weight(.semibold)
    static let cardTitle = Font.title3.weight(.semibold)
    static let rowTitle = Font.headline
    static let body = Font.body
    static let value = Font.headline.weight(.semibold)

    /// Uppercase mono kicker (web `--mono` label rows).
    static let kicker = Font.system(.caption2, design: .monospaced).weight(.semibold)
    /// Monospaced time/count run.
    static let mono = Font.system(.footnote, design: .monospaced)
    static let monoSmall = Font.system(.caption2, design: .monospaced)
}
