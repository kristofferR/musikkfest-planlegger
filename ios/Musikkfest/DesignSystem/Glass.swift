import SwiftUI

/// Liquid Glass card surface (iOS 26). Adapted from krisHQ's `KrisGlassModifier`,
/// keeping the same stack: glass effect, hairline border, top highlight, accent
/// halo, and a scheme-aware shadow.
struct GlassCardModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    var accent: Color?
    var cornerRadius: CGFloat
    var padding: CGFloat

    private var borderColor: Color {
        scheme == .dark ? Color.white.opacity(0.10) : Color.white.opacity(0.30)
    }
    private var shadowColor: Color {
        scheme == .dark ? Color.black.opacity(0.5) : Color.black.opacity(0.08)
    }
    private var shadowRadius: CGFloat { scheme == .dark ? 22 : 28 }
    private var shadowY: CGFloat { scheme == .dark ? 14 : 18 }
    private var haloOpacity: Double { scheme == .dark ? 0.40 : 0.28 }
    private var topHighlight: Double { scheme == .dark ? 0.12 : 0.0 }

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        content
            .padding(padding)
            .background(.clear)
            .glassEffect(.regular, in: shape)
            .overlay { shape.strokeBorder(borderColor, lineWidth: 1) }
            .overlay(alignment: .top) {
                LinearGradient(colors: [Color.white.opacity(topHighlight), .clear],
                               startPoint: .top, endPoint: .center)
                    .clipShape(shape)
                    .allowsHitTesting(false)
            }
            .overlay(alignment: .topLeading) {
                if let accent {
                    Circle()
                        .fill(accent.opacity(haloOpacity))
                        .frame(width: 110, height: 110)
                        .blur(radius: 28)
                        .offset(x: -26, y: -36)
                        .allowsHitTesting(false)
                }
            }
            .shadow(color: shadowColor, radius: shadowRadius, y: shadowY)
    }
}

extension View {
    func glassCard(accent: Color? = nil, cornerRadius: CGFloat = 24, padding: CGFloat = Spacing.panel) -> some View {
        modifier(GlassCardModifier(accent: accent, cornerRadius: cornerRadius, padding: padding))
    }
}

/// Warm festival background — the suboktav earth-tone wash with soft halos.
struct FestivalBackground: View {
    @Environment(\.colorScheme) private var scheme

    private var gradient: [Color] {
        scheme == .dark
            ? [Color(hex: "11100d"), Color(hex: "15120d"), Color(hex: "0d0b08")]
            : [Color(hex: "f5f3ee"), Color(hex: "fffaf5"), Color(hex: "f2efe7")]
    }
    private var halo: (Double, Double, Double) {
        scheme == .dark ? (0.16, 0.10, 0.07) : (0.20, 0.16, 0.13)
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
            Circle().fill(Color(hex: "d4522a").opacity(halo.0))
                .frame(width: 360, height: 360).blur(radius: 60)
                .offset(x: -150, y: -240)
            Circle().fill(Color(hex: "f3b924").opacity(halo.1))
                .frame(width: 300, height: 300).blur(radius: 56)
                .offset(x: 160, y: -180)
            Circle().fill(Color(hex: "2a9d64").opacity(halo.2))
                .frame(width: 320, height: 320).blur(radius: 64)
                .offset(x: 120, y: 360)
        }
    }
}
