import SwiftUI

struct LineupView: View {
    @Environment(AppModel.self) private var model
    @State private var showFilters = false
    @State private var selectedEvent: Event?

    private var filtered: [Event] {
        model.program.eventsSortedByTime.filter(model.matches)
    }

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ZStack {
                FestivalBackground()

                VStack(spacing: 0) {
                    controlBar
                    ActiveFiltersBar()

                    if filtered.isEmpty {
                        EmptyStateView(
                            symbol: "magnifyingglass",
                            title: "Ingen treff",
                            message: model.hasActiveFilters
                                ? "Ingen innslag passer filteret. Prøv å fjerne noen filtre."
                                : "Fant ingen innslag."
                        )
                    } else if model.lineupViewMode == .stage {
                        StageListView(events: filtered) { selectedEvent = $0 }
                    } else {
                        TimeListView(events: filtered) { selectedEvent = $0 }
                    }
                }
            }
            .navigationTitle("Musikkfest 2026")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text("Musikkfest 2026").font(.headline)
                        Text("6. juni · Oslo").font(.caption2).foregroundStyle(Theme.textMuted)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showFilters = true } label: {
                        Image(systemName: model.hasActiveFilters
                              ? "line.3.horizontal.decrease.circle.fill"
                              : "line.3.horizontal.decrease.circle")
                    }
                    .accessibilityLabel("Filtrer")
                }
            }
            .searchable(text: $model.searchText, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Søk artist eller scene")
            .sheet(isPresented: $showFilters) { FilterSheet() }
            .navigationDestination(item: $selectedEvent) { event in
                EventDetailView(event: event)
            }
        }
    }

    private var controlBar: some View {
        @Bindable var model = model
        return HStack(spacing: Spacing.medium) {
            SegmentedSelector(
                segments: [
                    .init(value: LineupViewMode.stage, title: "Scener", systemImage: "mappin.and.ellipse"),
                    .init(value: LineupViewMode.time, title: "Tidslinje", systemImage: "clock"),
                ],
                selection: $model.lineupViewMode
            )
            .frame(maxWidth: 280)

            Spacer(minLength: 0)

            Text("\(filtered.count)")
                .font(Typography.mono)
                .foregroundStyle(Theme.textFaint)
        }
        .padding(.horizontal, Spacing.large)
        .padding(.top, Spacing.small)
        .padding(.bottom, Spacing.xSmall)
    }
}

/// Generic empty-state panel.
struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: Spacing.medium) {
            Image(systemName: symbol)
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Theme.textFaint)
            Text(title).font(.headline).foregroundStyle(Theme.textPrimary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xLarge)
    }
}
