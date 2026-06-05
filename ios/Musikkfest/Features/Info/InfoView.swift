import SwiftUI

struct InfoView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.large) {
                    statusCard
                    aboutCard
                    linksCard
                    creditsCard
                    #if DEBUG
                    debugCard
                    #endif
                }
                .padding(Spacing.large)
                .padding(.bottom, Spacing.xxLarge)
            }
            .background(FestivalBackground())
            .navigationTitle("Info")
        }
    }

    private var statusCard: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in
            let clock = model.clock(now: context.date)
            VStack(alignment: .leading, spacing: Spacing.xSmall) {
                Text("MUSIKKFEST OSLO 2026").font(Typography.kicker).foregroundStyle(Theme.textFaint)
                switch clock.mode {
                case .before:
                    Text("6. juni").font(.title.weight(.bold)).foregroundStyle(Theme.textPrimary)
                    Text("Festivalen starter \(clock.countdownText.lowercased()).")
                        .font(.subheadline).foregroundStyle(Theme.textMuted)
                case .live:
                    Label("Pågår nå", systemImage: "dot.radiowaves.left.and.right")
                        .font(.title2.weight(.bold)).foregroundStyle(Theme.accent)
                    Text("Sjekk Kart-fanen for hva som spilles i nærheten.")
                        .font(.subheadline).foregroundStyle(Theme.textMuted)
                case .after:
                    Text("Takk for i år!").font(.title.weight(.bold)).foregroundStyle(Theme.textPrimary)
                    Text("Musikkfest 2026 er over. Vi sees neste år.")
                        .font(.subheadline).foregroundStyle(Theme.textMuted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassCard(accent: Theme.accent, cornerRadius: 22, padding: Spacing.large)
        }
    }

    private var aboutCard: some View {
        infoCard(title: "Om appen") {
            Text("En uoffisiell planlegger for Musikkfest Oslo 2026 med interaktivt program, kart, favoritter og delbare lister. Programdata hentes fra det offisielle programmet.")
                .font(.subheadline).foregroundStyle(Theme.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var linksCard: some View {
        infoCard(title: "Lenker") {
            VStack(spacing: 0) {
                linkRow("Offisiell Musikkfest", "globe", URL(string: "https://musikkfest.no")!)
                Divider().overlay(Theme.border)
                linkRow("Web-app (suboktav.no)", "safari", URL(string: "https://suboktav.no/musikkfest/")!)
                Divider().overlay(Theme.border)
                linkRow("Kildekode på GitHub", "chevron.left.forwardslash.chevron.right",
                        URL(string: "https://github.com/kristofferR")!)
            }
        }
    }

    private var creditsCard: some View {
        infoCard(title: "Laget av") {
            Text("Kristoffer Risanger. Uoffisielt – ikke tilknyttet Musikkfest Oslo.")
                .font(.footnote).foregroundStyle(Theme.textMuted)
        }
    }

    #if DEBUG
    private var debugCard: some View {
        @Bindable var model = model
        return infoCard(title: "Debug · simuler tid") {
            VStack(alignment: .leading, spacing: Spacing.small) {
                Toggle("Simuler festival-tid", isOn: Binding(
                    get: { model.debugNowMinutes != nil },
                    set: { model.debugNowMinutes = $0 ? 13 * 60 : nil }
                ))
                .tint(Theme.accent)
                if let minutes = model.debugNowMinutes {
                    Text("Simulert nå: \(String(format: "%02d:%02d", (minutes / 60) % 24, minutes % 60))")
                        .font(Typography.mono).foregroundStyle(Theme.textMuted)
                    Slider(value: Binding(
                        get: { Double(minutes) },
                        set: { model.debugNowMinutes = Int($0) }
                    ), in: Double(10 * 60)...Double(26 * 60), step: 15)
                    .tint(Theme.accent)
                }
            }
        }
    }
    #endif

    private func linkRow(_ title: String, _ symbol: String, _ url: URL) -> some View {
        Button { openURL(url) } label: {
            HStack(spacing: Spacing.small) {
                Image(systemName: symbol).foregroundStyle(Theme.accent).frame(width: 24)
                Text(title).font(.subheadline).foregroundStyle(Theme.textPrimary)
                Spacer()
                Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(Theme.textFaint)
            }
            .padding(.vertical, Spacing.small)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func infoCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            Text(title.uppercased()).font(Typography.kicker).foregroundStyle(Theme.textFaint)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.large)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.border, lineWidth: 1)))
    }
}
