import CoreLocation
import MapKit
import SwiftUI
import UIKit

/// Venue status, matching the web map exactly (src/js/03-map.js):
/// now = an act is playing, soon = an act is still coming, idle = done for the day.
enum VenueStatus {
    case now, soon, idle

    /// Fixed colours from the web, independent of light/dark so dots read
    /// consistently on the map tiles.
    var color: Color {
        switch self {
        case .now: return Color(hex: "d4522a")
        case .soon: return Color(hex: "2a9d64")
        case .idle: return Color(hex: "2a6dd4")
        }
    }
    /// Solid dot diameter (web radii: now 8, soon 7, idle 6).
    var dotDiameter: CGFloat {
        switch self { case .now: 16; case .soon: 14; case .idle: 12 }
    }
    /// Soft halo diameter (web radii: now 15, soon 13, idle 11).
    var haloDiameter: CGFloat {
        switch self { case .now: 30; case .soon: 26; case .idle: 22 }
    }
    var haloOpacity: Double {
        switch self { case .now: 0.22; case .soon: 0.18; case .idle: 0.14 }
    }
}

struct MapTabView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    private static let osloCenter = CLLocationCoordinate2D(latitude: 59.929924, longitude: 10.750722)

    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(center: osloCenter,
                           span: MKCoordinateSpan(latitudeDelta: 0.085, longitudeDelta: 0.085))
    )
    @State private var selectedStage: Stage?
    @State private var selectedEvent: Event?
    @State private var activeSheet: MapSheet?
    /// One-time "Filter" hint next to the map filter button, dismissed on first use.
    @AppStorage("musikkfest-map-filter-hint-seen") private var filterHintSeen = false

    /// A single sheet binding — two separate `.sheet` modifiers on one view
    /// conflict in SwiftUI and one silently fails to present.
    private enum MapSheet: Identifiable {
        case venue(Stage)
        case filters
        var id: String {
            switch self {
            case .venue(let stage): return "venue-\(stage.id)"
            case .filters: return "filters"
            }
        }
    }

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            GeometryReader { geo in
                TimelineView(.periodic(from: .now, by: 60)) { context in
                    let clock = model.clock(now: context.date)
                    VStack(spacing: 0) {
                        mapView(clock: clock)
                            .frame(height: geo.size.height * 0.55) // ~half the screen
                            .overlay {
                                if clock.mode == .after { festivalOverOverlay }
                            }
                        LiveListPanel(clock: clock, onSelectEvent: { selectedEvent = $0 })
                            .frame(maxHeight: .infinity)
                    }
                    // The whole stack bleeds under the status bar and the floating
                    // tab bar — uniformly, so the map and panel meet with no gap.
                    .ignoresSafeArea(edges: [.top, .bottom])
                }
            }
            // Controls overlay on the safe-area-respecting content, so they sit
            // just below the status bar (near the battery), not pushed down.
            .overlay(alignment: .topTrailing) {
                mapControls
                    .padding(.top, Spacing.small)
                    .padding(.trailing, Spacing.medium)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(item: $selectedEvent) { event in
                EventDetailView(event: event)
            }
            .sheet(item: $activeSheet) { sheet in
                switch sheet {
                case .venue(let stage): StageSheet(stage: stage)
                case .filters: FilterSheet()
                }
            }
            .onChange(of: model.mapFocusStageID) { _, newValue in
                guard let id = newValue, let stage = model.program.stagesByID[id] else { return }
                withAnimation(.easeInOut(duration: 0.5)) {
                    camera = .region(MKCoordinateRegion(center: stage.coordinate,
                                                        span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.008)))
                }
                selectedStage = stage
                activeSheet = .venue(stage)
                model.mapFocusStageID = nil
            }
            .onAppear {
                // Live distance to scenes is a core feature — ask for location the
                // first time the user opens the map (Info.plist explains why).
                if model.location.authorizationStatus == .notDetermined {
                    model.location.requestWhenInUse()
                } else {
                    model.location.startIfAuthorized()
                }
            }
        }
    }

    private func mapView(clock: FestivalClock) -> some View {
        Map(position: $camera) {
            // Custom "you are here" marker — deliberately not blue, so it can't be
            // confused with the blue idle venue dots.
            if let user = model.location.userLocation {
                Annotation("Min posisjon", coordinate: user.coordinate, anchor: .center) {
                    UserHereMarker()
                }
                .annotationTitles(.hidden)
            }

            ForEach(model.program.stages.filter(stageHasMatch)) { stage in
                Annotation(stage.name, coordinate: stage.coordinate, anchor: .center) {
                    MapVenueDot(status: venueStatus(stage, clock: clock),
                                isSelected: selectedStage?.id == stage.id)
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                camera = .region(MKCoordinateRegion(center: stage.coordinate,
                                                                    span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)))
                            }
                            selectedStage = stage
                            activeSheet = .venue(stage)
                        }
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .mapControls {
            MapCompass()
            MapScaleView()
        }
    }

    private var mapControls: some View {
        VStack(alignment: .trailing, spacing: 10) {
            mapCircleButton(
                systemName: model.location.isAuthorized ? "location.fill" : "location",
                tint: Theme.accentBlue,
                label: "Vis min posisjon"
            ) { locateAction() }

            HStack(spacing: 8) {
                if model.hasActiveFilters {
                    filterPill("Filtrert.", tint: Theme.accent)
                } else if !filterHintSeen {
                    filterPill("Filter", tint: Theme.textPrimary)
                }
                mapCircleButton(
                    systemName: model.hasActiveFilters
                        ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle",
                    tint: model.hasActiveFilters ? Theme.accent : Theme.accentBlue,
                    label: "Filtrer"
                ) {
                    withAnimation(.easeOut(duration: 0.25)) { filterHintSeen = true }
                    activeSheet = .filters
                }
            }
        }
    }

    private func filterPill(_ text: String, tint: Color) -> some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.regularMaterial, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.border, lineWidth: 1))
            .shadow(color: .black.opacity(0.15), radius: 4, y: 1)
            .transition(.opacity.combined(with: .move(edge: .trailing)))
    }

    private func mapCircleButton(systemName: String, tint: Color, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 21, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 52, height: 52)
                .background(.regularMaterial, in: Circle())
                .overlay(Circle().strokeBorder(Theme.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.18), radius: 6, y: 2)
        }
        .accessibilityLabel(label)
    }

    private func locateAction() {
        switch model.location.authorizationStatus {
        case .notDetermined:
            model.location.requestWhenInUse()
        case .denied, .restricted:
            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
        default:
            if let loc = model.location.userLocation {
                withAnimation(.easeInOut(duration: 0.4)) {
                    camera = .region(MKCoordinateRegion(center: loc.coordinate,
                                                        span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)))
                }
            } else {
                model.location.startIfAuthorized()
            }
        }
    }

    private var festivalOverOverlay: some View {
        ZStack {
            Rectangle().fill(.ultraThinMaterial)
            VStack(spacing: Spacing.medium) {
                Text("🎪").font(.system(size: 44))
                Text("Takk for i år!").font(.title2.weight(.bold)).foregroundStyle(Theme.textPrimary)
                Text("Musikkfest 2026 er over. Vi sees neste år.")
                    .font(.subheadline).foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(Spacing.xLarge)
            .glassCard(accent: Theme.accent, cornerRadius: 24)
            .padding(Spacing.xLarge)
        }
    }

    /// Only show a venue dot if it has at least one event matching the active
    /// filter (so filtering the program also filters the map).
    private func stageHasMatch(_ stage: Stage) -> Bool {
        (model.program.eventsByStage[stage.id] ?? []).contains(where: model.matches)
    }

    private func venueStatus(_ stage: Stage, clock: FestivalClock) -> VenueStatus {
        let now = clock.nowMinutes
        let events = (model.program.eventsByStage[stage.id] ?? []).filter(model.matches)
        if events.contains(where: { $0.startMinutes <= now && now < $0.endMinutes }) { return .now }
        if events.contains(where: { $0.startMinutes > now }) { return .soon }
        return .idle
    }
}

/// "Du er her" marker, replicating the web's user marker exactly: a gold halo
/// with a near-black centre dot (white strokes), an expanding gold pulse ring,
/// and a label above. Gold so it never blends with the blue idle venue dots.
struct UserHereMarker: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let gold = Color(hex: "f3b924")
    /// Web pulse loops every 1800 ms.
    private let period = 1.8

    var body: some View {
        // The marker itself is a FIXED 34pt frame so neither the dot nor the
        // label move as the pulse ring (drawn behind, overflowing) expands.
        ZStack {
            Circle().fill(gold)
                .frame(width: 34, height: 34)
                .overlay(Circle().strokeBorder(.white, lineWidth: 3))
            Circle().fill(Color(hex: "111111"))
                .frame(width: 16, height: 16)
                .overlay(Circle().strokeBorder(.white, lineWidth: 2))
        }
        .frame(width: 34, height: 34)
        .background {
            if reduceMotion {
                Circle().fill(gold.opacity(0.22)).frame(width: 52, height: 52)
            } else {
                TimelineView(.animation) { context in
                    let progress = context.date.timeIntervalSinceReferenceDate
                        .truncatingRemainder(dividingBy: period) / period
                    Circle().fill(gold.opacity(0.40 * (1 - progress)))
                        .frame(width: 34 + progress * 44, height: 34 + progress * 44)
                }
            }
        }
        .overlay(alignment: .top) {
            Text("Du er her")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color(hex: "111111"))
                .shadow(color: .white, radius: 1.5)
                .shadow(color: .white, radius: 1.5)
                .fixedSize()
                .offset(y: -16)
        }
        .accessibilityLabel("Du er her")
    }
}

/// Venue dot, replicating the web's two-layer halo + solid dot. The selected
/// venue gets an extra ring so it's clearly the active place.
struct MapVenueDot: View {
    let status: VenueStatus
    var isSelected: Bool = false

    var body: some View {
        ZStack {
            Circle().fill(status.color.opacity(status.haloOpacity))
                .frame(width: status.haloDiameter, height: status.haloDiameter)
            if isSelected {
                Circle().strokeBorder(status.color, lineWidth: 2.5)
                    .frame(width: status.dotDiameter + 12, height: status.dotDiameter + 12)
                    .shadow(color: status.color.opacity(0.5), radius: 4)
            }
            Circle().fill(status.color)
                .frame(width: status.dotDiameter, height: status.dotDiameter)
                .overlay(Circle().strokeBorder(.white, lineWidth: 2))
                .opacity(0.98)
        }
    }
}

/// A bottom sheet listing a single venue's program, with one-tap navigation in
/// Apple or Google Maps. Artist details push within the sheet (no nested sheet).
struct StageSheet: View {
    let stage: Stage
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var detailEvent: Event?
    @State private var showNavigationOptions = false

    private var events: [Event] {
        (model.program.eventsByStage[stage.id] ?? []).sorted { $0.startMinutes < $1.startMinutes }
    }

    private var distanceText: String? {
        guard let user = model.location.userLocation else { return nil }
        let meters = user.distance(from: CLLocation(latitude: stage.latitude, longitude: stage.longitude))
        let walkMin = Int((meters / LiveListPanel.walkMetersPerMinute).rounded())
        let distStr = meters < 950 ? "\(Int((meters / 10).rounded()) * 10) m" : String(format: "%.1f km", meters / 1000)
        return walkMin <= 1 ? "\(distStr) unna" : "\(distStr) · ~\(walkMin) min å gå"
    }

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 60)) { context in
                let now = model.clock(now: context.date).nowMinutes
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.large) {
                        navigationButton
                        if let distance = distanceText {
                            Label(distance, systemImage: "figure.walk")
                                .font(.subheadline.weight(.medium)).foregroundStyle(Theme.accentBlue)
                        }
                        if let info = stage.info {
                            Text(info).font(.footnote).foregroundStyle(Theme.textMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        eventSections(now: now)
                    }
                    .padding(Spacing.large)
                }
                .background(FestivalBackground())
                .navigationTitle(stage.name)
                .navigationBarTitleDisplayMode(.inline)
                .navigationDestination(item: $detailEvent) { event in
                    EventDetailView(event: event)
                }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { dismiss() } label: { Image(systemName: "xmark") }
                            .accessibilityLabel("Lukk")
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    /// Splits the venue's program into "playing now", "coming up" and "done"
    /// so the live + next acts are front-and-centre and the past is dimmed.
    @ViewBuilder
    private func eventSections(now: Int) -> some View {
        let nowEvents = events.filter { $0.startMinutes <= now && now < $0.endMinutes }
        let futureEvents = events.filter { $0.startMinutes > now }
        let pastEvents = events.filter { $0.endMinutes <= now }

        VStack(alignment: .leading, spacing: Spacing.large) {
            if !nowEvents.isEmpty {
                eventGroup(title: "Spiller nå", events: nowEvents, accent: true)
            }
            if !futureEvents.isEmpty {
                eventGroup(title: (nowEvents.isEmpty && pastEvents.isEmpty) ? "Program" : "Kommende",
                           events: futureEvents)
            }
            if !pastEvents.isEmpty {
                eventGroup(title: "Ferdig", events: pastEvents, dimmed: true)
            }
        }
    }

    private func eventGroup(title: String, events: [Event], accent: Bool = false, dimmed: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xSmall) {
            Text(title.uppercased())
                .font(Typography.kicker)
                .foregroundStyle(accent ? Theme.accent : Theme.textFaint)
            VStack(spacing: 0) {
                ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                    if index > 0 { Divider().overlay(Theme.border) }
                    EventRow(event: event, showStage: false) { detailEvent = event }
                        .padding(.horizontal, Spacing.small)
                }
            }
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(accent ? Theme.accent.opacity(0.10) : Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(accent ? Theme.accent.opacity(0.35) : Theme.border, lineWidth: 1))
            )
            .opacity(dimmed ? 0.5 : 1)
        }
    }

    private var navigationButton: some View {
        Button { showNavigationOptions = true } label: {
            HStack(spacing: Spacing.small) {
                Image(systemName: "mappin.circle.fill").font(.title3).foregroundStyle(Theme.accentBlue)
                VStack(alignment: .leading, spacing: 1) {
                    Text(stage.address ?? "Åpne i kart").font(.subheadline.weight(.medium)).foregroundStyle(Theme.textPrimary)
                    Text("Naviger hit").font(.caption).foregroundStyle(Theme.accentBlue)
                }
                Spacer()
                Image(systemName: "arrow.triangle.turn.up.right.diamond.fill").foregroundStyle(Theme.accentBlue)
            }
            .padding(Spacing.medium)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.accentBlue.opacity(0.10)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .confirmationDialog("Naviger til \(stage.name)", isPresented: $showNavigationOptions, titleVisibility: .visible) {
            Button("Apple Maps") { openAppleMaps() }
            Button("Google Maps") { openGoogleMaps() }
            Button("Avbryt", role: .cancel) {}
        }
        .accessibilityLabel("Naviger til \(stage.name)")
    }

    private func openAppleMaps() {
        let item = MKMapItem(placemark: MKPlacemark(coordinate: stage.coordinate))
        item.name = stage.name
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking])
    }

    private func openGoogleMaps() {
        let destination = "\(stage.latitude),\(stage.longitude)"
        if let url = URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(destination)&travelmode=walking") {
            openURL(url)
        }
    }
}
