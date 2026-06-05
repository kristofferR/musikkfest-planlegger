import SwiftUI

/// Per-genre badge colors, taken verbatim from the web app's `.g-*` CSS classes
/// (light) and their `:root[data-theme="dark"]` overrides (dark) so the native
/// badges match suboktav.no exactly.
enum GenrePalette {
    /// key -> (lightBackground, lightForeground, darkSolid). Dark foreground is white.
    private static let table: [String: (lightBg: String, lightFg: String, darkBg: String)] = [
        "Rock": ("fdeee8", "8b2d0f", "b73a1f"),
        "Pop": ("edeafd", "3d2ea0", "6750d8"),
        "Elektronika": ("e4effd", "1155a0", "1769c2"),
        "HipHop": ("fdf4e0", "7a4a00", "b96112"),
        "Verdensmusikk": ("fde8f2", "8b1f5a", "bd3578"),
        "Reggae": ("e7f8ec", "1a5c2c", "268249"),
        "Jazz": ("e2f7f0", "0d5940", "087f68"),
        "Blues": ("e5f0fd", "0f4a8a", "235fb0"),
        "Folk": ("fdf0e0", "7a3c00", "a9561d"),
        "Punk": ("fde8e8", "8b1a1a", "c92d3f"),
        "Metal": ("f0efee", "3d3b38", "4b4742"),
        "Vise": ("fef8e0", "6b5200", "876f09"),
        "Kor": ("ede9fd", "452ea0", "6147bf"),
        "Country": ("fdf0e8", "7a3000", "aa5422"),
        "Singer": ("f8e8fd", "6b1a8b", "9340b2"),
        "Korps": ("f0efee", "5a5856", "64737b"),
        "RnB": ("f0e6f8", "52206d", "7643a3"),
        "Stoy": ("ebe9e4", "25231f", "5c554e"),
        "Annet": ("f0efee", "5a5856", "68615a"),
    ]

    private static let fallback = (lightBg: "f0efee", lightFg: "5a5856", darkBg: "68615a")

    struct Style {
        let foreground: Color
        let background: Color
    }

    static func style(for key: String, scheme: ColorScheme) -> Style {
        let c = table[key] ?? fallback
        if scheme == .dark {
            return Style(foreground: .white, background: Color(hex: c.darkBg))
        }
        return Style(foreground: Color(hex: c.lightFg), background: Color(hex: c.lightBg))
    }

    /// A solid, saturated genre color (the web dark-mode badge color) — used to
    /// fill the genre filter chip when selected.
    static func tint(for key: String) -> Color {
        Color(hex: (table[key] ?? fallback).darkBg)
    }
}

/// A small genre badge capsule matching the web `.g-*` styling.
struct GenreBadge: View {
    let genreKey: String
    let label: String
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let style = GenrePalette.style(for: genreKey, scheme: scheme)
        Text(label)
            .font(.caption2.weight(.semibold))
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(style.foreground)
            .background(Capsule(style: .continuous).fill(style.background))
    }
}
