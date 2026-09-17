import SwiftUI

// MARK: - Reusable styles

extension Text {
    /// The web's `.eyebrow` class: small, semibold, uppercase, letterspaced,
    /// in the palette's primary.
    @ViewBuilder
    func eyebrowStyle(_ theme: ThemeColors) -> some View {
        font(AppFont.geist(11, .semibold))
            .kerning(2.2)
            .textCase(.uppercase)
            .foregroundStyle(theme.primary)
    }
}

/// The web's `.editorial-surface`: warm card with a soft border and a
/// two-layer shadow.
struct EditorialSurfaceModifier: ViewModifier {
    @Environment(ThemeStore.self) private var theme

    var cornerRadius: CGFloat

    func body(content: Content) -> some View {
        let shadow = Color(red: 48 / 255, green: 28 / 255, blue: 10 / 255)
        content
            .background(theme.colors.card)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(theme.colors.border.opacity(0.7), lineWidth: 1)
            }
            .shadow(color: shadow.opacity(0.04), radius: 1, y: 1)
            .shadow(color: shadow.opacity(0.06), radius: 30, y: 18)
    }
}

extension View {
    func editorialSurface(cornerRadius: CGFloat = 12) -> some View {
        modifier(EditorialSurfaceModifier(cornerRadius: cornerRadius))
    }

    /// Paper background for List/Form screens — the grouped default gray is
    /// replaced with the themed canvas plus the warm top tint.
    func paperScreen() -> some View {
        modifier(PaperScreenModifier())
    }
}

private struct PaperScreenModifier: ViewModifier {
    @Environment(ThemeStore.self) private var theme

    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .toolbarBackground(theme.colors.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .background(
                ZStack(alignment: .topLeading) {
                    theme.colors.background
                    LinearGradient(
                        colors: [theme.colors.backgroundTint, .clear],
                        startPoint: .topLeading,
                        endPoint: .center
                    )
                    .ignoresSafeArea()
                }
                .ignoresSafeArea()
            )
    }
}
