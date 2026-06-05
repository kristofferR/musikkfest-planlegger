import SwiftUI

enum AppAnimation {
    static let screenTransition = Animation.spring(duration: 0.5, bounce: 0.18)
    static let cardEntrance = Animation.spring(duration: 0.7, bounce: 0.24)
    static let pillSnap = Animation.easeInOut(duration: 0.22)
    static let nowLine = Animation.easeInOut(duration: 0.6)

    /// Returns `nil` (no animation) when Reduce Motion is enabled, matching the
    /// web's `prefers-reduced-motion` handling.
    static func respectingReduceMotion(_ animation: Animation?, reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : animation
    }
}
