import ImageIO
import SwiftUI
import TraveletIslandKit
import UIKit

extension Color {
  /// Parses the `#rrggbb` tints the app stores alongside each category.
  init(islandHex hex: String, fallback: Color = .blue) {
    var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if cleaned.hasPrefix("#") { cleaned.removeFirst() }

    guard cleaned.count == 6, let value = UInt32(cleaned, radix: 16) else {
      self = fallback
      return
    }

    self.init(
      .sRGB,
      red: Double((value >> 16) & 0xff) / 255,
      green: Double((value >> 8) & 0xff) / 255,
      blue: Double(value & 0xff) / 255,
      opacity: 1
    )
  }
}

extension IslandSelection {
  var tint: Color {
    Color(islandHex: category?.tint ?? "#2563eb")
  }

  var deepLink: URL? {
    IslandStore.deepLink(category: category, document: document)
  }

  /// Loaded synchronously — widget views cannot await, so the crop has to be a
  /// file already sitting in the App Group.
  ///
  /// Decoded straight to display size rather than at full resolution: the stored
  /// code is ~1100px, the island shows it at 120pt, and widget extensions run
  /// under a hard memory cap that a handful of full-size bitmaps would breach.
  var barcodeImage: UIImage? {
    guard let url = IslandStore.barcodeURL(file: document?.barcodeFile) else { return nil }
    return UIImage.downsampled(from: url, maxPixels: 420)
  }
}

extension UIImage {
  static func downsampled(from url: URL, maxPixels: CGFloat) -> UIImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else { return nil }

    let options = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixels,
      // Nearest-neighbour-ish: keep the module edges hard rather than smeared.
      kCGImageSourceShouldCacheImmediately: true,
    ] as [CFString: Any] as CFDictionary

    guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
    return UIImage(cgImage: thumbnail)
  }
}
