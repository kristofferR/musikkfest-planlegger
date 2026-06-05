import SwiftUI

/// Horizontal bar of removable active-filter chips, shown under the toolbar when
/// any genre/stage/favorites filter is active.
struct ActiveFiltersBar: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        if model.activeFilterCount > 0 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    if model.favoritesOnly {
                        ActiveFilterChip(title: "Favoritter", tint: Theme.favorite) {
                            model.favoritesOnly = false
                        }
                    }
                    ForEach(Array(model.selectedGenres).sorted(), id: \.self) { key in
                        ActiveFilterChip(title: model.genreLabel(key), tint: Theme.accent) {
                            model.selectedGenres.remove(key)
                        }
                    }
                    ForEach(Array(model.selectedStages).sorted(), id: \.self) { stage in
                        ActiveFilterChip(title: stage, tint: Theme.accentBlue) {
                            model.selectedStages.remove(stage)
                        }
                    }
                    Button("Nullstill") { model.clearFilters() }
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.leading, 4)
                }
                .padding(.horizontal, Spacing.large)
                .padding(.vertical, 6)
            }
        }
    }
}
