import SwiftUI

@main
struct MusikkfestApp: App {
    @State private var model: AppModel

    init() {
        let program = ProgramStore.loadBundled()
        let favorites = FavoritesStore()
        let location = LocationManager()
        _model = State(initialValue: AppModel(program: program, favorites: favorites, location: location))
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(model)
                .tint(Theme.accentBlue)
        }
    }
}
