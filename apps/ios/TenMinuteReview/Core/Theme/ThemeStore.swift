import Foundation
import Observation

/// Palette choice, stored under the same `UI_THEME` key the web app uses
/// for its cookie. When signed in, the account's `uiTheme` overrides it on
/// every user refresh. Default mirrors `DEFAULT_THEME` — mint.
@MainActor
@Observable
final class ThemeStore {
    private(set) var palette: Palette
    var colors: ThemeColors

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let raw = defaults.string(forKey: Self.storageKey)
        let palette = raw.flatMap(Palette.init(rawValue:)) ?? .mint
        self.palette = palette
        self.colors = ThemeColors(palette: palette)
    }

    func select(_ palette: Palette) {
        self.palette = palette
        defaults.set(palette.rawValue, forKey: Self.storageKey)
        colors = ThemeColors(palette: palette)
    }

    private static let storageKey = "UI_THEME"
}
