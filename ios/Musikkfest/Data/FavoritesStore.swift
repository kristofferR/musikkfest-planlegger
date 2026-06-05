import Foundation
import Observation

/// Local favorites + list name, persisted in `UserDefaults`. Uses the same key
/// and value shape (`["id", ...]`) as the web app for conceptual parity.
@MainActor
@Observable
final class FavoritesStore {
    nonisolated static let favoritesKey = "musikkfest-oslo-2026-favorites"
    nonisolated static let listNameKey = "musikkfest-oslo-2026-favorite-list-name"
    nonisolated static let defaultListName = "Favoritter"

    private(set) var ids: Set<String>
    var listName: String {
        didSet { persistName() }
    }
    /// Bumped whenever a favorite is added, so views can trigger a confetti burst.
    private(set) var addCount = 0

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let stored = defaults.data(forKey: Self.favoritesKey),
           let array = try? JSONDecoder().decode([String].self, from: stored) {
            self.ids = Set(array)
        } else if let array = defaults.array(forKey: Self.favoritesKey) as? [String] {
            self.ids = Set(array)
        } else {
            self.ids = []
        }
        let storedName = defaults.string(forKey: Self.listNameKey) ?? Self.defaultListName
        self.listName = storedName.isEmpty ? Self.defaultListName : storedName
    }

    func isFavorite(_ id: String) -> Bool { ids.contains(id) }

    /// Toggles and returns the new state. Increments `addCount` when adding.
    @discardableResult
    func toggle(_ id: String) -> Bool {
        if ids.contains(id) {
            ids.remove(id)
            persist()
            return false
        } else {
            ids.insert(id)
            addCount += 1
            persist()
            return true
        }
    }

    func remove(_ id: String) {
        guard ids.contains(id) else { return }
        ids.remove(id)
        persist()
    }

    func resetName() { listName = Self.defaultListName }

    var count: Int { ids.count }

    private func persist() {
        let array = Array(ids)
        if let data = try? JSONEncoder().encode(array) {
            defaults.set(data, forKey: Self.favoritesKey)
        }
    }

    private func persistName() {
        let clean = listName.trimmingCharacters(in: .whitespacesAndNewlines)
        defaults.set(clean.isEmpty ? Self.defaultListName : clean, forKey: Self.listNameKey)
    }
}
