import SwiftUI

/// Artist/performance detail. Pushed onto the navigation stack (not a sheet) so
/// it reads as a full screen with a back button.
struct EventDetailView: View {
    let event: Event
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.large) {
                if let url = event.imageURL {
                    artwork(url)
                }
                header
                if !event.descriptionText.isEmpty {
                    descriptionView
                } else {
                    Text("Ingen artisttekst registrert hos Musikkfest ennå.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textMuted)
                }
                actions
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.large)
            .padding(.bottom, Spacing.xxLarge)
        }
        .background(FestivalBackground())
        .navigationTitle(event.artist)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: FavoriteShare.appURL,
                          subject: Text(event.artist),
                          message: Text("\(event.artist) – \(event.time), \(event.stage) (Musikkfest 2026)")) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
    }

    private func artwork(_ url: URL) -> some View {
        // Color.clear fixes the layout footprint (full width × 220); the image
        // rides as an overlay so a scaledToFill image — which is scaled to be
        // far wider than the frame — can never drive the ScrollView's content
        // width. That leak was pushing the whole detail view sideways (clipped
        // on both edges) for events with a real, wide artwork image.
        Color.clear
            .frame(maxWidth: .infinity)
            .frame(height: 220)
            .overlay {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .empty:
                        Rectangle().fill(Theme.surfaceMuted).overlay(ProgressView())
                    default:
                        // No fallback placeholder — collapse to a quiet muted fill on failure.
                        Rectangle().fill(Theme.surfaceMuted)
                    }
                }
            }
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.border, lineWidth: 1))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            HStack(spacing: 8) {
                Text(event.time).font(Typography.mono).foregroundStyle(Theme.textMuted)
                GenreBadge(genreKey: event.genreKey, label: event.genreLabel)
            }
            Text(event.artist)
                .font(.title.weight(.bold))
                .foregroundStyle(Theme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                dismiss()
                model.showOnMap(stage: event.stage)
            } label: {
                Label(event.stage, systemImage: "mappin.and.ellipse")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.accentBlue)
            }
            .buttonStyle(.plain)
        }
    }

    private var descriptionView: some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            ForEach(paragraphs, id: \.self) { paragraph in
                Text(paragraph)
                    .font(.body)
                    .foregroundStyle(Theme.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var paragraphs: [String] {
        event.descriptionText
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private var actions: some View {
        VStack(spacing: Spacing.small) {
            Button {
                model.favorites.toggle(event.id)
            } label: {
                Label(model.favorites.isFavorite(event.id) ? "I favoritter" : "Legg til favoritt",
                      systemImage: model.favorites.isFavorite(event.id) ? "star.fill" : "star")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(model.favorites.isFavorite(event.id) ? Theme.favorite : Theme.accentBlue)
            .controlSize(.large)

            Button {
                openURL(ArtistLinks.googleSearchURL(artist: event.artist))
            } label: {
                Label("Søk på artist", systemImage: "magnifyingglass").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .tint(Theme.accentBlue)
        }
    }
}
