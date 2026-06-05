import SwiftUI
import UIKit

extension Color {
    /// Builds a color from a hex string (`#RRGGBB` or `RRGGBB`).
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let red = Double((value >> 16) & 0xFF) / 255.0
        let green = Double((value >> 8) & 0xFF) / 255.0
        let blue = Double(value & 0xFF) / 255.0
        self.init(red: red, green: green, blue: blue)
    }

    /// Builds a dynamic color that resolves to `light` in light mode and `dark`
    /// in dark mode, following the system trait automatically.
    init(light: String, dark: String) {
        self = Color(uiColor: UIColor { trait in
            UIColor(Color(hex: trait.userInterfaceStyle == .dark ? dark : light))
        })
    }
}

/// The festival palette, lifted verbatim from the web app's CSS custom
/// properties (`src/styles.css`) so the native app matches suboktav.no exactly.
enum Theme {
    // Surfaces
    static let background = Color(light: "f5f3ee", dark: "11100d")
    static let surface = Color(light: "ffffff", dark: "1d1a16")
    static let surfaceSoft = Color(light: "faf9f7", dark: "24211b")
    static let surfaceWarm = Color(light: "fffaf5", dark: "211c16")
    static let surfaceMuted = Color(light: "ece8df", dark: "302b24")
    static let surfaceRaised = Color(light: "ffffff", dark: "29251f")
    /// The dark "ink" tone used for the web topbar/drawer and high-contrast pills.
    static let ink = Color(light: "1a1814", dark: "080706")

    // Text
    static let textPrimary = Color(light: "1a1814", dark: "f2eee6")
    static let textMuted = Color(light: "6b6760", dark: "b8afa1")
    static let textFaint = Color(light: "a8a49e", dark: "7f776c")

    // Accents
    static let accent = Color(light: "d4522a", dark: "e5683e")
    static let accentBlue = Color(light: "2a6dd4", dark: "7faaff")
    static let favorite = Color(light: "e0ac15", dark: "f3b924")

    static let border = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(white: 1, alpha: 0.12)
            : UIColor(white: 0, alpha: 0.09)
    })

    // Live map status colors (from src/js/03-map.js)
    static let statusNow = accent
    static let statusSoon = Color(light: "2a9d64", dark: "3fcf8a")
    static let statusIdle = accentBlue
    static let userMarker = Color(hex: "f3b924")

    /// Soft tinted background for a given accent (≈ web's `softColor`).
    static func soft(_ color: Color, _ scheme: ColorScheme) -> Color {
        color.opacity(scheme == .dark ? 0.26 : 0.16)
    }
}
