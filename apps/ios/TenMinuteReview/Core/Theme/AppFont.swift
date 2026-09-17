import SwiftUI

/// Typography, matching the web app's Geist sans and Source Serif 4
/// editorial headings. Sizes are expressed relative to text styles so
/// Dynamic Type scales them with the user's setting.
enum AppFont {
    static func geist(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let name: String
        switch weight {
        case .medium: name = "Geist-Medium"
        case .semibold: name = "Geist-SemiBold"
        case .bold: name = "Geist-Bold"
        default: name = "Geist-Regular"
        }
        return Font.custom(name, size: size, relativeTo: size >= 20 ? .title3 : size >= 15 ? .body : .caption)
    }

    static func editorial(_ size: CGFloat, bold: Bool = false) -> Font {
        Font.custom(
            bold ? "SourceSerif4-Bold" : "SourceSerif4-SemiBold",
            size: size,
            relativeTo: .largeTitle
        )
    }
}
