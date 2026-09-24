import SwiftUI
import UIKit

/// The four palettes from `packages/core/src/theme.ts`. On iOS a palette
/// supplies the app-wide tint — buttons, toggles, links, and progress —
/// while every surface, font, and text colour comes from the system.
enum Palette: String, CaseIterable, Identifiable {
    case mint
    case sky
    case sakura
    case lavender

    var id: String { rawValue }

    var hue: Double {
        switch self {
        case .mint: return 165
        case .sky: return 232
        case .sakura: return 350
        case .lavender: return 300
        }
    }

    var chroma: Double {
        switch self {
        case .mint: return 0.072
        case .sky: return 0.066
        case .sakura: return 0.064
        case .lavender: return 0.062
        }
    }

    var label: String { rawValue.capitalized }

    /// Preview swatch, matching `THEME_SWATCHES`.
    var swatch: Color {
        switch self {
        case .mint: return Color(hex: 0x4D796B)
        case .sky: return Color(hex: 0x536F89)
        case .sakura: return Color(hex: 0x895F70)
        case .lavender: return Color(hex: 0x746780)
        }
    }

    /// The web's `--primary` token, resolved for light and dark appearance.
    var tint: Color {
        let light = oklch(0.46, chroma, hue)
        let dark = oklch(0.73, chroma, hue)
        return Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
