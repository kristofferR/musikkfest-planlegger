import SwiftUI

/// Unified genre / stage / favorites filter, shared by Lineup and Map.
struct FilterSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var detent: PresentationDetent = .large

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ZStack {
                FestivalBackground()
                ScrollView {
                VStack(alignment: .leading, spacing: Spacing.xLarge) {
                    favoritesToggle

                    section("Sjanger") {
                        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                            ForEach(model.program.genres) { genre in
                                GlassChip(title: genre.label,
                                          isSelected: model.selectedGenres.contains(genre.key),
                                          tint: GenrePalette.tint(for: genre.key)) {
                                    model.toggleGenre(genre.key)
                                }
                            }
                        }
                    }

                    section("Scene") {
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8)], alignment: .leading, spacing: 8) {
                            ForEach(model.program.stageNamesWithEvents, id: \.self) { stage in
                                GlassChip(title: stage,
                                          isSelected: model.selectedStages.contains(stage),
                                          tint: Theme.accentBlue) {
                                    model.toggleStage(stage)
                                }
                            }
                        }
                    }
                }
                .padding(Spacing.large)
                }
                // Dissolve the bottom edge into the background so it's clear the
                // list scrolls further — masks content, not a grey overlay band.
                .mask(
                    LinearGradient(stops: [
                        .init(color: .black, location: 0),
                        .init(color: .black, location: 0.93),
                        .init(color: .clear, location: 1.0),
                    ], startPoint: .top, endPoint: .bottom)
                )
            }
            .navigationTitle("Filter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Nullstill") { model.clearFilters() }
                        .disabled(!model.hasActiveFilters)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
    }

    private var favoritesToggle: some View {
        @Bindable var model = model
        return Toggle(isOn: $model.favoritesOnly) {
            Label("Bare favoritter", systemImage: "star.fill")
                .foregroundStyle(Theme.textPrimary)
        }
        .tint(Theme.favorite)
        .padding(Spacing.medium)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border, lineWidth: 1)))
    }

    @ViewBuilder
    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            Text(title.uppercased())
                .font(Typography.kicker)
                .foregroundStyle(Theme.textFaint)
            content()
        }
    }
}
