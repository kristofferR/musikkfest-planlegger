import SwiftUI

/// A glassy 2..n-segment selector with an animated sliding highlight. Used for
/// the Lineup Stage/Time toggle and the Map "soon" sort modes. Adapted from the
/// krisHQ `DayScopeSelector` glass aesthetic.
struct SegmentedSelector<Value: Hashable>: View {
    struct Segment: Identifiable {
        let value: Value
        let title: String
        var systemImage: String?
        var id: Value { value }
    }

    let segments: [Segment]
    @Binding var selection: Value

    @Namespace private var ns
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 4) {
            ForEach(segments) { segment in
                let isSelected = segment.value == selection
                Button {
                    withAnimation(AppAnimation.respectingReduceMotion(AppAnimation.pillSnap, reduceMotion: reduceMotion)) {
                        selection = segment.value
                    }
                } label: {
                    HStack(spacing: 5) {
                        if let symbol = segment.systemImage {
                            Image(systemName: symbol).font(.caption.weight(.semibold))
                        }
                        Text(segment.title)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    // Web uses a dark "ink" active pill (var(--text)), not the accent.
                    .foregroundStyle(isSelected ? Theme.background : Theme.textMuted)
                    .background {
                        if isSelected {
                            Capsule(style: .continuous)
                                .fill(Theme.textPrimary)
                                .matchedGeometryEffect(id: "seg-highlight", in: ns)
                        }
                    }
                    .contentShape(Capsule(style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
            }
        }
        .padding(4)
        .background {
            Capsule(style: .continuous).fill(Theme.surfaceMuted.opacity(0.7))
        }
        .overlay {
            Capsule(style: .continuous).strokeBorder(Theme.border, lineWidth: 1)
        }
    }
}
