import SwiftUI
import UIKit

/// The four palettes from `packages/core/src/theme.ts`. A palette supplies
/// the hue and chroma every colour token derives from; the paper hue stays
/// fixed across palettes — mirroring the web stylesheet.
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
}

private let paperHue = 82.0
private let inkHue = 64.0

/// Every colour token from `apps/web/app/globals.css`, with light and dark
/// values resolved through UIColor dynamic providers.
struct ThemeColors {
    let background: Color
    let foreground: Color
    let card: Color
    let primary: Color
    let primaryForeground: Color
    let secondary: Color
    let secondaryForeground: Color
    let muted: Color
    let mutedForeground: Color
    let accent: Color
    let accentForeground: Color
    let destructive: Color
    let success: Color
    let warning: Color
    let border: Color
    let input: Color
    let ring: Color
    /// The warm radial tint at the top of the page background.
    let backgroundTint: Color

    init(palette: Palette) {
        let hue = palette.hue
        let chroma = palette.chroma
        func dynamic(_ light: @autoclosure @escaping () -> Color,
                     _ dark: @autoclosure @escaping () -> Color) -> Color {
            Color(UIColor { trait in
                trait.userInterfaceStyle == .dark ? UIColor(dark()) : UIColor(light())
            })
        }

        background = dynamic(
            oklch(0.975, 0.008, paperHue),
            oklch(0.165, 0.01, inkHue)
        )
        foreground = dynamic(
            oklch(0.235, 0.018, inkHue),
            oklch(0.945, 0.008, paperHue)
        )
        card = dynamic(
            oklch(0.995, 0.004, paperHue),
            oklch(0.205, 0.012, inkHue)
        )
        primary = dynamic(
            oklch(0.46, chroma, hue),
            oklch(0.73, chroma, hue)
        )
        primaryForeground = dynamic(
            oklch(0.985, 0.004, paperHue),
            oklch(0.19, 0.018, inkHue)
        )
        secondary = dynamic(
            oklch(0.948, 0.012, hue),
            oklch(0.255, 0.014, hue)
        )
        secondaryForeground = dynamic(
            oklch(0.31, 0.028, hue),
            oklch(0.945, 0.008, paperHue)
        )
        muted = dynamic(
            oklch(0.945, 0.008, paperHue),
            oklch(0.255, 0.01, inkHue)
        )
        mutedForeground = dynamic(
            oklch(0.49, 0.018, inkHue),
            oklch(0.69, 0.015, paperHue)
        )
        accent = dynamic(
            oklch(0.94, 0.018, hue),
            oklch(0.265, 0.02, hue)
        )
        accentForeground = dynamic(
            oklch(0.31, 0.028, hue),
            oklch(0.945, 0.008, paperHue)
        )
        destructive = dynamic(
            oklch(0.545, 0.2, 27.325),
            oklch(0.704, 0.191, 22.216)
        )
        success = dynamic(
            oklch(0.5, 0.13, 152),
            oklch(0.72, 0.15, 155)
        )
        warning = dynamic(
            oklch(0.5, 0.11, 65),
            oklch(0.78, 0.14, 75)
        )
        border = dynamic(
            oklch(0.885, 0.01, paperHue),
            Color.white.opacity(0.10)
        )
        input = dynamic(
            oklch(0.86, 0.012, paperHue),
            Color.white.opacity(0.15)
        )
        ring = dynamic(
            oklch(0.53, 0.07, hue),
            oklch(0.62, 0.06, hue)
        )
        backgroundTint = dynamic(
            oklch(0.82, 0.035, hue, alpha: 0.16),
            oklch(0.25, 0.015, hue, alpha: 0.20)
        )
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
