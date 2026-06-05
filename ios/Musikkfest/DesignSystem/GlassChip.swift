import SwiftUI

/// A pill/chip used for filters (genres, stages, favorites). Selected chips fill
/// with their tint; unselected chips are quiet outlined capsules.
struct GlassChip: View {
    let title: String
    var systemImage: String?
    let isSelected: Bool
    var tint: Color = Theme.accent
    let action: () -> Void

    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let systemImage {
                    Image(systemName: systemImage).font(.caption2.weight(.semibold))
                }
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .foregroundStyle(isSelected ? Color.white : Theme.textMuted)
            .background {
                Capsule(style: .continuous)
                    .fill(isSelected ? tint : Theme.surfaceMuted.opacity(scheme == .dark ? 0.6 : 0.9))
            }
            .overlay {
                Capsule(style: .continuous)
                    .strokeBorder(isSelected ? tint : Theme.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// A small removable active-filter chip (shown in the active-filters bar).
struct ActiveFilterChip: View {
    let title: String
    var tint: Color = Theme.accent
    let onRemove: () -> Void

    var body: some View {
        Button(action: onRemove) {
            HStack(spacing: 4) {
                Text(title).font(.caption.weight(.medium)).lineLimit(1)
                Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).opacity(0.7)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(.white)
            .background(Capsule(style: .continuous).fill(tint))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Fjern filter: \(title)")
    }
}
