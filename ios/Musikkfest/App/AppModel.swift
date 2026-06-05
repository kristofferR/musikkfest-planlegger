import Foundation
import Observation
import SwiftUI

enum AppTab: Hashable {
    case lineup, map, saved, info

    var title: String {
        switch self {
        case .lineup: return "Program"
        case .map: return "Kart"
        case .saved: return "Lagret"
        case .info: return "Info"
        }
    }
    var symbol: String {
        switch self {
        case .lineup: return "music.note.list"
        case .map: return "map"
        case .saved: return "star"
        case .info: return "info.circle"
        }
    }
}

enum LineupViewMode: String, CaseIterable { case stage, time }

enum SoonSortMode: String, CaseIterable {
    // Order + names mirror the web: Kommende, Smart, Distanse.
    case upcoming, smart, distance
    var title: String {
        switch self {
        case .upcoming: return "Kommende"
        case .smart: return "Smart"
        case .distance: return "Distanse"
        }
    }
}

/// Central app state: festival data, favorites, shared filters, navigation, and
/// the (debug-overridable) festival clock.
@MainActor
@Observable
final class AppModel {
    let program: ProgramStore
    let favorites: FavoritesStore
    let location: LocationManager

    var selectedTab: AppTab = .lineup

    // Shared filter state (Lineup + Map stay in sync, mirroring the web).
    var searchText: String = ""
    var selectedGenres: Set<String> = []
    var selectedStages: Set<String> = []
    var favoritesOnly: Bool = false

    var soonSortMode: SoonSortMode = .smart

    /// When set, the Map tab focuses this stage (e.g. from "Vis på kart").
    var mapFocusStageID: String?

    private static let viewModeKey = "musikkfest-program-view-mode"
    var lineupViewMode: LineupViewMode {
        didSet { UserDefaults.standard.set(lineupViewMode.rawValue, forKey: Self.viewModeKey) }
    }

    /// DEBUG override for the festival clock (minutes on the festival scale).
    var debugNowMinutes: Int?

    init(program: ProgramStore, favorites: FavoritesStore, location: LocationManager) {
        self.program = program
        self.favorites = favorites
        self.location = location
        let stored = UserDefaults.standard.string(forKey: Self.viewModeKey)
        self.lineupViewMode = stored.flatMap(LineupViewMode.init) ?? .stage
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-debugNowMinutes"), i + 1 < args.count, let minutes = Int(args[i + 1]) {
            self.debugNowMinutes = minutes
        }
        #endif
    }

    // MARK: - Filtering

    var hasActiveFilters: Bool {
        !selectedGenres.isEmpty || !selectedStages.isEmpty || favoritesOnly
            || !searchText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var activeFilterCount: Int {
        selectedGenres.count + selectedStages.count + (favoritesOnly ? 1 : 0)
    }

    func matches(_ event: Event) -> Bool {
        if favoritesOnly && !favorites.isFavorite(event.id) { return false }
        if !selectedGenres.isEmpty && !selectedGenres.contains(event.genreKey) { return false }
        if !selectedStages.isEmpty && !selectedStages.contains(event.stage) { return false }
        let query = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        if !query.isEmpty {
            let hay = "\(event.artist) \(event.stage) \(event.genreLabel)".lowercased()
            if !hay.contains(query) { return false }
        }
        return true
    }

    func clearFilters() {
        selectedGenres.removeAll()
        selectedStages.removeAll()
        favoritesOnly = false
        searchText = ""
    }

    func toggleGenre(_ key: String) {
        if selectedGenres.contains(key) { selectedGenres.remove(key) } else { selectedGenres.insert(key) }
    }
    func toggleStage(_ key: String) {
        if selectedStages.contains(key) { selectedStages.remove(key) } else { selectedStages.insert(key) }
    }

    // MARK: - Navigation

    func showOnMap(stage: String) {
        mapFocusStageID = stage
        selectedTab = .map
    }

    func clock(now: Date) -> FestivalClock {
        FestivalClock(now: now, overrideMinutes: debugNowMinutes)
    }

    func genreLabel(_ key: String) -> String {
        program.genres.first { $0.key == key }?.label ?? key
    }
}
