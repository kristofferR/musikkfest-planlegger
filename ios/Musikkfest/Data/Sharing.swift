import Foundation

/// Reproduces the web app's favorite share-code so links open the existing web
/// app and stay cross-compatible:
///   https://suboktav.no/musikkfest/del/?f=<base36-indices-joined-by-dot>&navn=<name>
/// where each index is the favorited event's position in canonical file order.
enum FavoriteShare {
    static let shareBaseURL = "https://suboktav.no/musikkfest/del/"
    static let appURL = URL(string: "https://suboktav.no/musikkfest/")!

    static func shareCode(favoriteIDs: Set<String>, orderedEvents: [Event]) -> String {
        orderedEvents.enumerated()
            .filter { favoriteIDs.contains($0.element.id) }
            .map { String($0.offset, radix: 36) }
            .joined(separator: ".")
    }

    static func shareURL(favoriteIDs: Set<String>, orderedEvents: [Event], listName: String) -> URL {
        guard var comps = URLComponents(string: shareBaseURL) else { return appURL }
        var items: [URLQueryItem] = []
        let code = shareCode(favoriteIDs: favoriteIDs, orderedEvents: orderedEvents)
        if !code.isEmpty { items.append(URLQueryItem(name: "f", value: code)) }
        let clean = listName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !clean.isEmpty, clean != FavoritesStore.defaultListName {
            items.append(URLQueryItem(name: "navn", value: clean))
        }
        comps.queryItems = items.isEmpty ? nil : items
        return comps.url ?? appURL
    }

    /// Share message text, matching the web tone.
    static func shareText(count: Int, listName: String) -> String {
        let clean = listName.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = (clean.isEmpty || clean == FavoritesStore.defaultListName) ? "" : "\n\n\(clean)"
        if count == 0 { return "Min Musikkfest 2026-plan\(name)" }
        return "Min Musikkfest 2026-plan – \(count) favoritter\(name)"
    }
}

/// External links for an event (artist search + official source).
enum ArtistLinks {
    static func googleSearchURL(artist: String) -> URL {
        let stripped = artist
            .replacingOccurrences(of: #"\s*\((?:live|dj-?set|konsert)\)\s*"#,
                                   with: " ", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        let name = stripped.isEmpty ? artist : stripped
        let support = "(spotify OR soundcloud OR bandcamp OR youtube OR instagram OR artist OR norge OR oslo)"
        var comps = URLComponents(string: "https://www.google.com/search")!
        comps.queryItems = [URLQueryItem(name: "q", value: "\"\(name)\" \(support)")]
        return comps.url ?? URL(string: "https://www.google.com")!
    }
}
