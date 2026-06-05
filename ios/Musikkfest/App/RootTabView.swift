import SwiftUI

struct RootTabView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            Tab(AppTab.lineup.title, systemImage: AppTab.lineup.symbol, value: AppTab.lineup) {
                LineupView()
            }
            Tab(AppTab.map.title, systemImage: AppTab.map.symbol, value: AppTab.map) {
                MapTabView()
            }
            Tab(AppTab.saved.title, systemImage: AppTab.saved.symbol, value: AppTab.saved) {
                SavedView()
            }
            .badge(model.favorites.count)
            Tab(AppTab.info.title, systemImage: AppTab.info.symbol, value: AppTab.info) {
                InfoView()
            }
        }
        .tint(Theme.accentBlue)
    }
}
