import CoreLocation
import SwiftUI
import UIKit

/// The live "Nærmeste musikk nå" panel under the map — spacious rows with the
/// start time, artist + venue, and (when location is granted) the walking
/// distance plus a genre badge on the right. Mirrors the web live list.
struct LiveListPanel: View {
    let clock: FestivalClock
    let onSelectEvent: (Event) -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    static let walkMetersPerMinute = 80.0

    @State private var liveTab: LiveTab = .now
    private enum LiveTab: Hashable { case now, soon }

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            SegmentedSelector(
                segments: [
                    .init(value: LiveTab.now, title: "Spiller nå"),
                    .init(value: LiveTab.soon, title: "Spiller snart"),
                ],
                selection: $liveTab
            )
            .padding(.horizontal, Spacing.large)
            .padding(.top, Spacing.large)
            .padding(.bottom, Spacing.small)

            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.medium) {
                    if !model.location.isAuthorized || model.location.userLocation == nil {
                        locationHint
                    }
                    if liveTab == .now {
                        nowContent
                    } else {
                        soonContent
                    }
                }
                .padding(.horizontal, Spacing.large)
                .padding(.top, Spacing.small)
                .padding(.bottom, 96) // clear the floating tab bar
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        // Slightly off-white so the white performance cards lift off the panel.
        .background(Theme.surfaceSoft)
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1) }
    }

    private var locationHint: some View {
        Button { updatePosition() } label: {
            HStack(spacing: 6) {
                Image(systemName: "location.circle")
                Text(model.location.isAuthorized ? "Finner posisjonen din…"
                                                  : "Slå på posisjon for å se avstand til scenene.")
                    .multilineTextAlignment(.leading)
            }
            .font(.footnote)
            .foregroundStyle(Theme.accentBlue)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var nowContent: some View {
        if nowEvents.isEmpty {
            Text(clock.mode == .before ? "Festivalen har ikke startet enda."
                                       : "Ingen pågående innslag akkurat nå.")
                .font(.footnote).foregroundStyle(Theme.textMuted)
                .padding(.top, Spacing.small)
        } else {
            VStack(spacing: rowSpacing) {
                ForEach(nowEvents) { liveRow($0) }
            }
        }
    }

    private var soonContent: some View {
        @Bindable var model = model
        return VStack(alignment: .leading, spacing: Spacing.medium) {
            SegmentedSelector(
                segments: SoonSortMode.allCases.map { .init(value: $0, title: $0.title) },
                selection: $model.soonSortMode
            )
            if soonEvents.isEmpty {
                Text("Ingen kommende innslag i denne listen.")
                    .font(.footnote).foregroundStyle(Theme.textMuted)
            } else {
                VStack(spacing: rowSpacing) {
                    ForEach(soonEvents) { liveRow($0) }
                }
            }
        }
    }

    /// Tight spacing between performance rows (half the section spacing).
    private let rowSpacing: CGFloat = 7

    private func liveRow(_ event: Event) -> some View {
        Button { onSelectEvent(event) } label: {
            HStack(spacing: Spacing.medium) {
                Text(event.time)
                    .font(Typography.mono)
                    .foregroundStyle(Theme.textFaint)
                    .frame(width: 46, alignment: .leading)

                VStack(alignment: .leading, spacing: 2) {
                    Text(event.artist)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    Text(event.stage)
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 4) {
                    if let time = timeLabel(event) {
                        Text(time).font(Typography.monoSmall).foregroundStyle(Theme.accent)
                    }
                    if let distance = distanceLabel(event) {
                        Text(distance).font(Typography.monoSmall).foregroundStyle(Theme.accentBlue)
                    }
                    GenreBadge(genreKey: event.genreKey, label: event.genreLabel)
                }
            }
            .padding(Spacing.medium)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.surface)
                    .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Theme.border.opacity(0.6), lineWidth: 0.5)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Actions

    private func updatePosition() {
        switch model.location.authorizationStatus {
        case .notDetermined:
            model.location.requestWhenInUse()
        case .denied, .restricted:
            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
        default:
            model.location.startIfAuthorized()
        }
    }

    // MARK: - Data

    private var filtered: [Event] { model.program.eventsSortedByTime.filter(model.matches) }

    private var nowEvents: [Event] {
        let now = clock.nowMinutes
        return filtered.filter { $0.startMinutes <= now && now < $0.endMinutes }
            .sorted(by: liveSort)
    }

    private var soonEvents: [Event] {
        let now = clock.nowMinutes
        let upcoming = filtered.filter { $0.startMinutes > now }
        let sorted: [Event]
        switch model.soonSortMode {
        case .upcoming:
            sorted = upcoming.sorted { ($0.startMinutes, $0.index) < ($1.startMinutes, $1.index) }
        case .distance:
            sorted = upcoming.sorted {
                (distanceMeters($0) ?? .greatestFiniteMagnitude, $0.startMinutes)
                    < (distanceMeters($1) ?? .greatestFiniteMagnitude, $1.startMinutes)
            }
        case .smart:
            sorted = upcoming.sorted { smartScore($0, now: now) < smartScore($1, now: now) }
        }
        return Array(sorted.prefix(40))
    }

    /// Now-playing rows sort by distance when we have a fix, else by stage.
    private func liveSort(_ a: Event, _ b: Event) -> Bool {
        if model.location.userLocation != nil {
            return (distanceMeters(a) ?? .greatestFiniteMagnitude) < (distanceMeters(b) ?? .greatestFiniteMagnitude)
        }
        return a.stage.localizedCaseInsensitiveCompare(b.stage) == .orderedAscending
    }

    private func distanceMeters(_ event: Event) -> Double? {
        guard let user = model.location.userLocation,
              let stage = model.program.stagesByID[event.stage] else { return nil }
        return user.distance(from: CLLocation(latitude: stage.latitude, longitude: stage.longitude))
    }

    private func walkMinutes(_ event: Event) -> Double? {
        distanceMeters(event).map { $0 / Self.walkMetersPerMinute }
    }

    private func smartScore(_ event: Event, now: Int) -> Double {
        Double(event.startMinutes - now) + (walkMinutes(event) ?? 0)
    }

    private func timeLabel(_ event: Event) -> String? {
        let delta = event.startMinutes - clock.nowMinutes
        if delta <= 0 { return nil }
        if delta >= 60 { return "om \(delta / 60)t \(delta % 60)m" }
        return "om \(delta) min"
    }

    private func distanceLabel(_ event: Event) -> String? {
        guard let meters = distanceMeters(event) else { return nil }
        if meters < 950 { return "\(Int((meters / 10).rounded()) * 10) m" }
        return String(format: "%.1f km", meters / 1000)
    }
}
