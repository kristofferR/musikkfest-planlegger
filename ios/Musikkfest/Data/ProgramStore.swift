import Foundation
import Observation

/// Loads `program.json` (bundled from the web app's source of truth) and builds
/// the indexed, denormalized domain model the UI consumes.
@MainActor
@Observable
final class ProgramStore {
    /// Events in canonical file order (index == share-code index).
    let events: [Event]
    let eventsByID: [String: Event]
    /// Events sorted chronologically (then by file index for stability).
    let eventsSortedByTime: [Event]
    /// All known venues, sorted by name.
    let stages: [Stage]
    let stagesByID: [String: Stage]
    /// Events grouped by stage name.
    let eventsByStage: [String: [Event]]
    /// Genres present in the program, in canonical order.
    let genres: [Genre]
    /// Stage names that actually host events (for the Lineup stage view).
    let stageNamesWithEvents: [String]

    /// Canonical genre ordering (matches the web `genreLabels` insertion order).
    static let canonicalGenreOrder = [
        "Rock", "Pop", "Elektronika", "HipHop", "Verdensmusikk", "Reggae", "Jazz",
        "Blues", "Folk", "Punk", "Metal", "Vise", "Kor", "Country", "Singer",
        "Korps", "RnB", "Stoy", "Annet",
    ]

    init(data: ProgramData) {
        let defaultImage = data.defaultArtistImageUrl

        var built: [Event] = []
        built.reserveCapacity(data.events.count)
        for (index, raw) in data.events.enumerated() {
            let detail = data.eventDetails[raw.id]
            let rawImage = (detail?.imageUrl ?? "").trimmingCharacters(in: .whitespaces)
            // The web treats the generic broadcast placeholder as "no image".
            let imageURL: URL? = (rawImage.isEmpty || rawImage == defaultImage) ? nil : URL(string: rawImage)
            let sourceString = detail?.sourceUrl.isEmpty == false
                ? detail!.sourceUrl
                : "https://musikkfest.no/nb/program#slot=\(raw.id)"
            built.append(Event(
                id: raw.id,
                index: index,
                time: raw.time,
                startMinutes: FestivalTime.minutes(from: raw.time),
                artist: raw.artist,
                genreKey: raw.genreKey,
                genreLabel: data.genreLabels[raw.genreKey] ?? raw.genreKey,
                stage: raw.stage,
                imageURL: imageURL,
                descriptionText: detail?.description ?? "",
                sourceURL: URL(string: sourceString)
            ))
        }
        self.events = built
        self.eventsByID = Dictionary(built.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        self.eventsSortedByTime = built.sorted {
            $0.startMinutes != $1.startMinutes ? $0.startMinutes < $1.startMinutes : $0.index < $1.index
        }

        // Stages: join locations with map info.
        var stageList: [Stage] = []
        for (key, loc) in data.stageLocations {
            let info = data.stageMapInfo[key]
            stageList.append(Stage(
                id: key,
                name: loc.label,
                latitude: loc.lat,
                longitude: loc.lng,
                address: info?.address,
                info: info?.info,
                query: loc.query
            ))
        }
        stageList.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        self.stages = stageList
        self.stagesByID = Dictionary(stageList.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })

        var grouped: [String: [Event]] = [:]
        for event in built { grouped[event.stage, default: []].append(event) }
        for key in grouped.keys {
            grouped[key]?.sort {
                $0.startMinutes != $1.startMinutes ? $0.startMinutes < $1.startMinutes : $0.index < $1.index
            }
        }
        self.eventsByStage = grouped
        self.stageNamesWithEvents = grouped.keys.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }

        let presentKeys = Set(built.map(\.genreKey))
        self.genres = ProgramStore.canonicalGenreOrder
            .filter { presentKeys.contains($0) }
            .map { Genre(key: $0, label: data.genreLabels[$0] ?? $0) }
    }

    /// Loads the bundled `program.json`. Traps on failure — the data ships in the
    /// app bundle, so a decode failure is a build error, not a runtime condition.
    static func loadBundled() -> ProgramStore {
        guard let url = Bundle.main.url(forResource: "program", withExtension: "json") else {
            fatalError("program.json missing from app bundle — run ios/scripts/sync-data.sh")
        }
        do {
            let raw = try Data(contentsOf: url)
            let decoded = try JSONDecoder().decode(ProgramData.self, from: raw)
            return ProgramStore(data: decoded)
        } catch {
            fatalError("Failed to decode program.json: \(error)")
        }
    }
}
