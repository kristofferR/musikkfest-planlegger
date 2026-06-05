import SwiftUI

struct SavedView: View {
    @Environment(AppModel.self) private var model
    @State private var selectedEvent: Event?
    @State private var confettiActive = false

    private var favoriteEvents: [Event] {
        model.program.eventsSortedByTime.filter { model.favorites.isFavorite($0.id) }
    }

    private var shareURL: URL {
        FavoriteShare.shareURL(favoriteIDs: model.favorites.ids,
                               orderedEvents: model.program.events,
                               listName: model.favorites.listName)
    }

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ZStack {
                FestivalBackground()
                if favoriteEvents.isEmpty {
                    EmptyStateView(
                        symbol: "star",
                        title: "Ingen favoritter ennå",
                        message: "Trykk stjerne i programmet for å bygge listen din. Den lagres på telefonen og kan deles."
                    )
                } else {
                    list
                }
                ConfettiView(active: confettiActive)
            }
            .navigationTitle("Lagret")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(item: $selectedEvent) { EventDetailView(event: $0) }
            .onChange(of: model.favorites.addCount) { _, _ in
                confettiActive = false
                DispatchQueue.main.async { confettiActive = true }
            }
        }
    }

    private var list: some View {
        @Bindable var model = model
        return ScrollView {
            VStack(spacing: Spacing.large) {
                headerCard

                ForEach(timeGroups, id: \.minutes) { group in
                    VStack(spacing: 0) {
                        HStack {
                            Text(group.time).font(Typography.mono.weight(.semibold)).foregroundStyle(Theme.textPrimary)
                            Spacer()
                        }
                        .padding(.horizontal, Spacing.medium)
                        .padding(.vertical, Spacing.xSmall)
                        ForEach(group.events) { event in
                            Divider().overlay(Theme.border)
                            EventRow(event: event, showStage: true,
                                     trailing: .remove { model.favorites.remove(event.id) }) {
                                selectedEvent = event
                            }
                            .padding(.horizontal, Spacing.medium)
                        }
                    }
                    .padding(.vertical, 4)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Theme.surface)
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.border, lineWidth: 1)))
                }
            }
            .padding(.horizontal, Spacing.large)
            .padding(.top, Spacing.small)
            .padding(.bottom, Spacing.xxLarge)
        }
        .scrollDismissesKeyboard(.immediately)
    }

    private var headerCard: some View {
        @Bindable var favorites = model.favorites
        return VStack(alignment: .leading, spacing: Spacing.medium) {
            Text("MIN LISTE").font(Typography.kicker).foregroundStyle(Theme.textFaint)
            TextField("Listenavn", text: $favorites.listName)
                .font(.title3.weight(.semibold))
                .textInputAutocapitalization(.words)
                .submitLabel(.done)
            HStack {
                Text("\(favoriteEvents.count) valgt")
                    .font(Typography.monoSmall).foregroundStyle(Theme.textMuted)
                Spacer()
                ShareLink(item: shareURL,
                          subject: Text("Musikkfest 2026"),
                          message: Text(FavoriteShare.shareText(count: favoriteEvents.count, listName: model.favorites.listName))) {
                    Label("Del liste", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
            }
        }
        .glassCard(accent: Theme.accent, cornerRadius: 22, padding: Spacing.large)
    }

    private var timeGroups: [TimeGroup] {
        Dictionary(grouping: favoriteEvents, by: \.startMinutes)
            .map { key, value in
                TimeGroup(minutes: key, time: value.first?.time ?? "",
                          events: value.sorted { $0.stage.localizedCaseInsensitiveCompare($1.stage) == .orderedAscending })
            }
            .sorted { $0.minutes < $1.minutes }
    }

    private struct TimeGroup {
        let minutes: Int
        let time: String
        let events: [Event]
    }
}
