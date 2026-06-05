import CoreLocation
import Foundation

// MARK: - Raw Codable mirror of src/data/program.json

/// Top-level structure of `program.json`.
struct ProgramData: Decodable {
    let events: [RawEvent]
    let eventDetails: [String: RawEventDetail]
    let genreLabels: [String: String]
    let defaultArtistImageUrl: String
    let stageLocations: [String: RawStageLocation]
    let stageMapInfo: [String: RawStageMapInfo]
}

/// Events are stored as compact 5-element positional arrays:
/// `[time, artist, genreKey, stage, objectId]`.
struct RawEvent: Decodable {
    let time: String
    let artist: String
    let genreKey: String
    let stage: String
    let id: String

    init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        time = try c.decode(String.self)
        artist = try c.decode(String.self)
        genreKey = try c.decode(String.self)
        stage = try c.decode(String.self)
        id = try c.decode(String.self)
    }
}

struct RawEventDetail: Decodable {
    let imageUrl: String
    let description: String
    let sourceUrl: String
}

struct RawStageLocation: Decodable {
    let label: String
    let lat: Double
    let lng: Double
    let query: String?
}

struct RawStageMapInfo: Decodable {
    let address: String?
    let info: String?
}

// MARK: - Domain model

struct Genre: Identifiable, Hashable, Sendable {
    let key: String
    let label: String
    var id: String { key }
}

/// A single performance/slot.
struct Event: Identifiable, Hashable, Sendable {
    let id: String
    /// Position in the canonical file order — used for share-code indices.
    let index: Int
    let time: String
    /// Minutes since midnight, day-crossing adjusted (after-midnight slots get +24h).
    let startMinutes: Int
    let artist: String
    let genreKey: String
    let genreLabel: String
    let stage: String
    let imageURL: URL?
    let descriptionText: String
    let sourceURL: URL?

    static let durationMinutes = 45
    var endMinutes: Int { startMinutes + Event.durationMinutes }

    static func == (lhs: Event, rhs: Event) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// A festival venue/stage.
struct Stage: Identifiable, Hashable, Sendable {
    let id: String          // stage key (== name used in events)
    let name: String        // display label
    let latitude: Double
    let longitude: Double
    let address: String?
    let info: String?
    let query: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    static func == (lhs: Stage, rhs: Stage) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - Time helpers

enum FestivalTime {
    /// Slots before 04:00 belong to the small hours of the *next* calendar day
    /// (festival runs ~10:00 → 02:00), so push them past midnight for ordering.
    /// Matches the web's `hour < 4 ? nextDay : day` slot-date rule.
    static let dayStartCutoff = 4 * 60

    static func minutes(from hhmm: String) -> Int {
        let parts = hhmm.split(separator: ":")
        guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return 0 }
        let raw = h * 60 + m
        return raw < dayStartCutoff ? raw + 24 * 60 : raw
    }

    /// "HH:MM" pretty-printer (input is already HH:MM, returned as-is).
    static func label(_ hhmm: String) -> String { hhmm }
}
