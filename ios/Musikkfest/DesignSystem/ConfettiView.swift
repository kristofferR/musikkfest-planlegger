import SwiftUI

private struct ConfettiPiece: Identifiable {
    let id = UUID()
    let color: Color
    let xSpread: CGFloat
    let fall: CGFloat
    let rotation: Double
    let delay: Double
    let size: CGFloat

    static func random(seed: Int) -> ConfettiPiece {
        // Festival palette: the suboktav popsicle yellow/lilac + warm accents.
        let palette: [Color] = [
            Color(hex: "f3b924"), Color(hex: "d97fd0"), Color(hex: "d4522a"),
            Color(hex: "2a9d64"), Color(hex: "2a6dd4"), Color(hex: "e5683e"),
        ]
        // Deterministic-ish spread from the seed so we don't need Math.random.
        func frac(_ a: Int) -> CGFloat { CGFloat((a &* 2654435761 >> 8) % 1000) / 1000 }
        return ConfettiPiece(
            color: palette[seed % palette.count],
            xSpread: frac(seed) * 2 - 1,
            fall: 0.5 + frac(seed &* 7) * 0.6,
            rotation: 180 + Double(frac(seed &* 13)) * 720,
            delay: Double(frac(seed &* 17)) * 0.25,
            size: 6 + frac(seed &* 19) * 5
        )
    }
}

/// Lightweight celebration burst. Flip `active` to true to fire. Suppressed under
/// Reduce Motion.
struct ConfettiView: View {
    let active: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pieces: [ConfettiPiece] = (0..<52).map { ConfettiPiece.random(seed: $0) }
    @State private var exploded = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                if active && !reduceMotion {
                    ForEach(pieces) { piece in
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .fill(piece.color)
                            .frame(width: piece.size, height: piece.size * 1.6)
                            .rotationEffect(.degrees(exploded ? piece.rotation : 0))
                            .position(
                                x: proxy.size.width / 2 + (exploded ? piece.xSpread * proxy.size.width * 0.5 : 0),
                                y: exploded ? proxy.size.height * piece.fall : proxy.size.height * 0.16
                            )
                            .opacity(exploded ? 0 : 1)
                            .animation(.easeOut(duration: 1.5).delay(piece.delay), value: exploded)
                    }
                }
            }
            .onChange(of: active) { _, now in
                if now { exploded = false; DispatchQueue.main.async { exploded = true } }
            }
        }
        .allowsHitTesting(false)
    }
}
