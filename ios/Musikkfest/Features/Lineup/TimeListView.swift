import SwiftUI

/// Lineup "Tidslinje" view: events grouped by start time, with a live now-line
/// during the festival that auto-scrolls into view on appear.
struct TimeListView: View {
    let events: [Event]
    let onSelect: (Event) -> Void

    @Environment(AppModel.self) private var model

    private var groups: [TimeGroup] {
        Dictionary(grouping: events, by: \.startMinutes)
            .map { key, value in
                TimeGroup(minutes: key,
                          time: value.first?.time ?? "",
                          events: value.sorted { $0.stage.localizedCaseInsensitiveCompare($1.stage) == .orderedAscending })
            }
            .sorted { $0.minutes < $1.minutes }
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            content(clock: model.clock(now: context.date))
        }
    }

    private func content(clock: FestivalClock) -> some View {
        let groups = self.groups
        let nowMinutes = clock.nowMinutes
        let insertIndex = groups.firstIndex { $0.minutes > nowMinutes } ?? groups.count
        let showNow = clock.isLive

        return ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spacing.small) {
                    ForEach(Array(groups.enumerated()), id: \.element.minutes) { index, group in
                        if showNow && index == insertIndex {
                            NowLine(label: clock.nowLabel).id("nowline").padding(.vertical, 2)
                        }
                        timeCard(group)
                    }
                    if showNow && insertIndex == groups.count {
                        NowLine(label: clock.nowLabel).id("nowline").padding(.vertical, 2)
                    }
                }
                .padding(.horizontal, Spacing.large)
                .padding(.top, Spacing.small)
                .padding(.bottom, Spacing.xxLarge)
            }
            .scrollDismissesKeyboard(.immediately)
            .onAppear {
                guard showNow else { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    withAnimation(.easeInOut(duration: 0.5)) {
                        proxy.scrollTo("nowline", anchor: .center)
                    }
                }
            }
        }
    }

    private func timeCard(_ group: TimeGroup) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(group.time)
                    .font(Typography.mono.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Text("\(group.events.count) stk")
                    .font(Typography.monoSmall)
                    .foregroundStyle(Theme.textFaint)
            }
            .padding(.horizontal, Spacing.medium)
            .padding(.vertical, Spacing.xSmall)

            ForEach(group.events) { event in
                Divider().overlay(Theme.border)
                EventRow(event: event, leading: .genre, showStage: true) { onSelect(event) }
                    .padding(.horizontal, Spacing.medium)
            }
        }
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.border, lineWidth: 1))
        )
    }

    private struct TimeGroup {
        let minutes: Int
        let time: String
        let events: [Event]
    }
}

/// The live "now" rule + time pill.
struct NowLine: View {
    let label: String
    var body: some View {
        HStack(spacing: 8) {
            Rectangle()
                .fill(Theme.accent)
                .frame(height: 2)
                .clipShape(Capsule())
            Text(label)
                .font(Typography.monoSmall.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Capsule().fill(Theme.accent))
        }
        .shadow(color: Theme.accent.opacity(0.3), radius: 6, y: 2)
        .accessibilityLabel("Nå: \(label)")
    }
}
