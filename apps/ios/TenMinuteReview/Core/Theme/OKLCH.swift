import SwiftUI

/// OKLCH → sRGB conversion (Björn Ottosson's OKLab transform), matching the
/// way browsers resolve the `oklch()` values in the web app's stylesheet —
/// so a token here renders the same colour as the same token on the web.
func oklch(_ lightness: Double, _ chroma: Double, _ hueDegrees: Double, alpha: Double = 1) -> Color {
    let hue = hueDegrees * .pi / 180
    let a = chroma * cos(hue)
    let b = chroma * sin(hue)

    let lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
    let mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
    let sPrime = lightness - 0.0894841775 * a - 1.2914855480 * b

    let l = lPrime * lPrime * lPrime
    let m = mPrime * mPrime * mPrime
    let s = sPrime * sPrime * sPrime

    let rLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    let gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    let bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    let r = gammaEncode(rLinear.clamped(to: 0...1))
    let g = gammaEncode(gLinear.clamped(to: 0...1))
    let bEncoded = gammaEncode(bLinear.clamped(to: 0...1))
    return Color(red: r, green: g, blue: bEncoded, opacity: alpha)
}

private func gammaEncode(_ channel: Double) -> Double {
    channel <= 0.0031308 ? 12.92 * channel : 1.055 * pow(channel, 1 / 2.4) - 0.055
}

extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
