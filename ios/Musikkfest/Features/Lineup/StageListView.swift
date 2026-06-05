import SwiftUI

/// Lineup "Scener" view: one collapsible glass card per stage.
struct StageListView: View {
    let events: [Event]
    let onSelect: (Event) -> Void

    @Environment(AppModel.self) private var model
    @State private var collapsed: Set<String> = []

    private var grouped: [(stage: String, events: [Event])] {
        Dictionary(grouping: events, by: \.stage)
            .map { (stage: $0.key, events: $0.value.sorted { $0.startMinutes < $1.startMinutes }) }
            .sorted { $0.stage.localizedCaseInsensitiveCompare($1.stage) == .orderedAscending }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.small) {
                ForEach(grouped, id: \.stage) { group in
                    stageCard(group.stage, group.events)
                }
            }
            .padding(.horizontal, Spacing.large)
            .padding(.top, Spacing.small)
            .padding(.bottom, Spacing.xxLarge)
        }
        .scrollDismissesKeyboard(.immediately)
    }

    private func stageCard(_ stage: String, _ stageEvents: [Event]) -> some View {
        let isCollapsed = collapsed.contains(stage)
        return VStack(spacing: 0) {
            Button {
                withAnimation(.snappy(duration: 0.25)) {
                    if isCollapsed { collapsed.remove(stage) } else { collapsed.insert(stage) }
                }
            } label: {
                HStack(spacing: Spacing.small) {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.textFaint)
                        .rotationEffect(.degrees(isCollapsed ? 0 : 90))
                    Text(stage)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    Text("\(stageEvents.count)")
                        .font(Typography.monoSmall)
                        .foregroundStyle(Theme.textFaint)
                    Button {
                        model.showOnMap(stage: stage)
                    } label: {
                        Image(systemName: "mappin.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(Theme.accentBlue)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Vis \(stage) på kart")
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if !isCollapsed {
                VStack(spacing: 0) {
                    ForEach(stageEvents) { event in
                        Divider().overlay(Theme.border)
                        EventRow(event: event, showStage: false) { onSelect(event) }
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, Spacing.medium)
        .padding(.vertical, Spacing.small)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.border, lineWidth: 1))
        )
    }
}
