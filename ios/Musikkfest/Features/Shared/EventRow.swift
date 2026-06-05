import SwiftUI

/// Star toggle for an event. Mutates the shared `FavoritesStore`.
struct FavoriteButton: View {
    let eventID: String
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let isFav = model.favorites.isFavorite(eventID)
        Button {
            withAnimation(AppAnimation.respectingReduceMotion(.snappy, reduceMotion: reduceMotion)) {
                _ = model.favorites.toggle(eventID)
            }
        } label: {
            Image(systemName: isFav ? "star.fill" : "star")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(isFav ? Theme.favorite : Theme.textFaint)
                .frame(width: 34, height: 34)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isFav ? "Fjern favoritt: \(eventID)" : "Legg til favoritt")
    }
}

/// Shared row used in Lineup, Saved, and live lists.
struct EventRow: View {
    let event: Event
    /// What the left column shows: the start time (stage view) or the genre
    /// badge (time view — the time is already in the section header).
    var leading: Leading = .time
    var showStage: Bool = true
    var trailing: Trailing = .favorite
    let onTap: () -> Void

    enum Leading { case time, genre }
    enum Trailing { case favorite, none, remove(() -> Void) }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.medium) {
                leadingView

                VStack(alignment: .leading, spacing: 3) {
                    Text(event.artist)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        if leading == .time {
                            GenreBadge(genreKey: event.genreKey, label: event.genreLabel)
                        }
                        if showStage {
                            Text(event.stage)
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer(minLength: 4)
                trailingView
            }
            .padding(.vertical, 7)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(event.time), \(event.artist), \(event.stage)")
    }

    @ViewBuilder
    private var leadingView: some View {
        switch leading {
        case .time:
            Text(event.time)
                .font(Typography.mono)
                .foregroundStyle(Theme.textFaint)
                .frame(width: 46, alignment: .leading)
        case .genre:
            GenreBadge(genreKey: event.genreKey, label: event.genreLabel)
                .frame(width: 104, alignment: .leading)
        }
    }

    @ViewBuilder
    private var trailingView: some View {
        switch trailing {
        case .favorite:
            FavoriteButton(eventID: event.id)
        case .none:
            EmptyView()
        case .remove(let action):
            Button(action: action) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.textMuted)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(Theme.surfaceMuted))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Fjern: \(event.artist)")
        }
    }
}
