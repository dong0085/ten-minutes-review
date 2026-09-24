import Foundation
import Observation

/// Palette choice, stored under the same `UI_THEME` key the web app uses
/// for its cookie. When signed in, the account's `uiTheme` overrides it on
/// every user refresh. Default mirrors `DEFAULT_THEME` — mint.
@MainActor
@Observable
final class ThemeStore {
    private(set) var palette: Palette

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let raw = defaults.string(forKey: Self.storageKey)
        self.palette = raw.flatMap(Palette.init(rawValue:)) ?? .mint
    }

    func select(_ palette: Palette) {
        self.palette = palette
        defaults.set(palette.rawValue, forKey: Self.storageKey)
    }

    private static let storageKey = "UI_THEME"
}
