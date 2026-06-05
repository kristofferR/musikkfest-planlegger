# Musikkfest — iOS app

Native iOS 26 (SwiftUI, Liquid Glass) app for the Musikkfest Oslo 2026 planner. Lives
in the same monorepo as the web app and shares its program data
(`../src/data/program.json`).

- **Bundle ID:** `no.suboktav.musikkfest`
- **Team:** `S5Q742QZEL`
- **Deployment target:** iOS 26.0 · Swift 6
- **Tabs:** Program · Kart · Lagret · Info

## Project generation

The Xcode project is generated from [`project.yml`](project.yml) with
[XcodeGen](https://github.com/yonyon/XcodeGen) and is **gitignored** — regenerate it
after adding/removing/renaming source files:

```bash
cd ios
xcodegen generate
open Musikkfest.xcodeproj   # or build from the CLI
```

A pre-build script syncs `../src/data/program.json` into the app bundle, so the web
app stays the single source of truth. To sync manually:

```bash
sh ios/scripts/sync-data.sh
```

## Build & run (simulator)

```bash
cd ios
xcodebuild -scheme Musikkfest -sdk iphonesimulator \
  -destination 'id=<SIMULATOR_UDID>' -derivedDataPath /tmp/Musikkfest-dd build \
  -IDEBuildOperationMaxNumberOfConcurrentCompileTasks=6
```

Then install + launch:

```bash
xcrun simctl install <SIMULATOR_UDID> /tmp/Musikkfest-dd/Build/Products/Debug-iphonesimulator/Musikkfest.app
xcrun simctl launch <SIMULATOR_UDID> no.suboktav.musikkfest
```

### Debug helpers

- `-debugNowMinutes <m>` launch argument simulates the festival clock at minute `m`
  on the festival-minute scale (e.g. `840` = 14:00), so you can exercise the live
  now-line and "Spiller nå / Spiller snart" lists outside the festival date. There's
  also a "Simuler festival-tid" control in the Info tab (DEBUG builds only).

## TestFlight

Prerequisites (one-time, in App Store Connect): the bundle ID `no.suboktav.musikkfest`
must be registered and an App record created (with a privacy policy URL, since the
Map tab uses location). The krisHQ App Store Connect API key is reused team-wide.

Bump `CURRENT_PROJECT_VERSION` in `project.yml` before every upload (re-run
`xcodegen generate`), then:

```bash
sh ios/scripts/sync-data.sh
source ios/.testflight-credentials   # ASC_API_KEY_ID / ASC_API_ISSUER_ID (gitignored)

cd ios && rm -rf /tmp/Musikkfest.xcarchive /tmp/Musikkfest-export /tmp/Musikkfest-archive-dd
xcodebuild archive -scheme Musikkfest -destination "generic/platform=iOS" \
  -archivePath /tmp/Musikkfest.xcarchive -derivedDataPath /tmp/Musikkfest-archive-dd \
  -IDEBuildOperationMaxNumberOfConcurrentCompileTasks=6 -allowProvisioningUpdates

xcodebuild -exportArchive -archivePath /tmp/Musikkfest.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath /tmp/Musikkfest-export \
  -allowProvisioningUpdates

xcrun altool --upload-app -f /tmp/Musikkfest-export/Musikkfest.ipa -t ios \
  --apiKey "$ASC_API_KEY_ID" --apiIssuer "$ASC_API_ISSUER_ID"
```

Apple processes the build for ~5–15 min before it appears in TestFlight.

## Layout

```
ios/
  project.yml              XcodeGen spec (source of truth for the project)
  ExportOptions.plist      App Store distribution export options
  scripts/sync-data.sh     copies ../src/data/program.json into the bundle
  Musikkfest/
    App/                   @main, AppModel, RootTabView (the 4 tabs)
    Models/                Codable program data, Event/Stage, FestivalClock
    Data/                  ProgramStore, FavoritesStore, LocationManager, Sharing
    DesignSystem/          Theme (web palette), Liquid Glass, tokens, components
    Features/              Lineup, Map, Saved, Info, EventDetail, Shared
    Resources/             program.json, Assets (AppIcon, AccentColor)
```
