import CoreGraphics
import Foundation
import ImageIO
import os
import PDFKit
import TraveletIslandKit
import UIKit
import UniformTypeIdentifiers
import Vision

private let log = Logger(subsystem: "com.wasserstiefel.travelet", category: "barcode")

public struct ExtractedBarcode {
  public let file: String
  public let uri: String
  public let payload: String?
  public let symbology: String
  public let page: Int
}

public struct ExtractedPreview {
  public let file: String
  public let uri: String
  public let width: Int
  public let height: Int
}

public enum BarcodeExtractionError: LocalizedError {
  case unreadablePDF
  case appGroupUnavailable
  case writeFailed

  public var errorDescription: String? {
    switch self {
    case .unreadablePDF: return "Could not open the PDF."
    case .appGroupUnavailable: return "Shared storage is unavailable."
    case .writeFailed: return "Could not save the barcode image."
    }
  }
}

/// Finds the boarding-pass / ticket barcode inside a PDF and keeps a faithful,
/// high-resolution crop of it.
///
/// The page is rasterised with PDFKit rather than digging image XObjects out of
/// the PDF, because plenty of issuers draw the symbol as vector rectangles
/// instead of embedding a bitmap. Rasterising handles both the same way.
///
/// The crop is the original pixels, not a symbol regenerated from the decoded
/// payload: re-encoding can quietly change error-correction level, character
/// set, or structured-append state, and this is a code someone holds up at a
/// gate. The payload is kept alongside as metadata.
public enum BarcodeExtractor {
  /// Long edge, in points, for the first pass — only used to *locate* the
  /// symbol, so it needs to be legible to Vision, not pretty.
  private static let scoutLongEdgePoints: CGFloat = 2000

  /// Long edge, in pixels, of the final crop. The symbol is re-rendered on its
  /// own at this size rather than being cut out of the scout image: a code
  /// typically occupies only a fraction of a page, so cropping the scout yields
  /// something like 200px, which visibly pixelates when shown full screen.
  /// Barcodes in issuer PDFs are almost always vector, so this is free detail.
  private static let symbolTargetPixels: CGFloat = 1100

  /// Fraction of the symbol's size added around the crop as a quiet zone.
  /// Scanners need clear margin; Vision's bounding box is tight to the symbol.
  private static let quietZoneRatio: CGFloat = 0.12

  private static let symbologies: [VNBarcodeSymbology] = [
    .qr, .pdf417, .aztec, .dataMatrix, .code128, .code39, .ean13, .ean8, .itf14,
  ]

  /// `VNDetectBarcodesRequest` has no implementation on the iOS Simulator — it
  /// returns zero results rather than erroring, so a perfectly good page looks
  /// like a document with no barcode. Only a physical device can confirm this
  /// path works.
  public static var detectionAvailableOnThisDevice: Bool {
    #if targetEnvironment(simulator)
      return false
    #else
      return true
    #endif
  }

  /// Scans up to `pageLimit` pages and keeps the largest symbol found — on a
  /// multi-code page the big one is the scannable ticket, the small ones are
  /// usually marketing or tracking codes.
  public static func extract(
    from filePath: String,
    documentId: String,
    pageLimit: Int = 3
  ) throws -> ExtractedBarcode? {
    let url = normalizedURL(filePath)
    log.debug("extract start id=\(documentId, privacy: .public) url=\(url.path, privacy: .public)")

    guard let pdf = PDFDocument(url: url) else {
      log.error("PDFDocument could not open \(url.path, privacy: .public)")
      throw BarcodeExtractionError.unreadablePDF
    }
    log.debug("opened pdf pages=\(pdf.pageCount)")

    for pageIndex in 0..<min(pdf.pageCount, pageLimit) {
      guard let page = pdf.page(at: pageIndex) else { continue }
      guard let image = render(page: page) else {
        log.error("render failed on page \(pageIndex)")
        continue
      }
      log.debug("rendered page \(pageIndex) \(image.width)x\(image.height)")

      guard let best = detect(in: image) else {
        log.debug("no symbol on page \(pageIndex)")
        continue
      }
      log.debug("found \(best.symbology.rawValue, privacy: .public) on page \(pageIndex)")

      // Preference order:
      //  1. a clean symbol redrawn from the decoded payload — no stray artwork
      //     or half-cropped human-readable text, sharp at any size
      //  2. the symbol re-rendered from the PDF at high resolution
      //  3. cutting it out of the scout image
      let cropped = regenerate(from: best)
        ?? highResolutionCrop(of: page, boundingBox: best.boundingBox)
        ?? crop(image: image, to: best.boundingBox)
      guard let cropped else {
        log.error("crop failed for box \(String(describing: best.boundingBox), privacy: .public)")
        continue
      }

      let file = try write(image: cropped, documentId: documentId)
      log.debug("wrote crop \(file, privacy: .public) \(cropped.width)x\(cropped.height)")
      guard let fileURL = IslandStore.barcodeURL(file: file) else {
        throw BarcodeExtractionError.appGroupUnavailable
      }

      return ExtractedBarcode(
        file: file,
        uri: fileURL.absoluteString,
        payload: best.payloadStringValue,
        symbology: label(for: best.symbology),
        page: pageIndex
      )
    }

    return nil
  }

  /// Renders page one as an image for documents that are meant to be *looked
  /// at* rather than scanned — a passport or an ID card carries no useful
  /// barcode, and hunting for one there wastes a Vision pass and returns
  /// nothing worth showing.
  public static func preview(from filePath: String, documentId: String, longEdge: CGFloat = 1400) throws -> ExtractedPreview? {
    let url = normalizedURL(filePath)
    guard let pdf = PDFDocument(url: url) else { throw BarcodeExtractionError.unreadablePDF }
    guard let page = pdf.page(at: 0) else { return nil }

    let bounds = page.bounds(for: .mediaBox)
    guard bounds.width > 0, bounds.height > 0 else { return nil }

    let scale = longEdge / max(bounds.width, bounds.height)
    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    guard let image = page.thumbnail(of: size, for: .mediaBox).cgImage else { return nil }

    let file = try write(image: image, documentId: "preview-\(documentId)")
    guard let fileURL = IslandStore.barcodeURL(file: file) else {
      throw BarcodeExtractionError.appGroupUnavailable
    }

    log.debug("wrote preview \(file, privacy: .public) \(image.width)x\(image.height)")
    return ExtractedPreview(file: file, uri: fileURL.absoluteString, width: image.width, height: image.height)
  }

  /// Every page as an image, for reading a document in the app.
  ///
  /// Cached under the document's id so opening it a second time costs nothing.
  /// Rendering is why this exists at all — a page image can be zoomed, paged and
  /// shown inline, where the PDF itself needs a whole viewer.
  public static let pageLimit = 12

  public static func pages(
    from filePath: String,
    documentId: String,
    limit: Int = pageLimit,
    longEdge: CGFloat = 2000
  ) throws -> [ExtractedPreview] {
    let url = normalizedURL(filePath)
    guard let pdf = PDFDocument(url: url) else { throw BarcodeExtractionError.unreadablePDF }

    var rendered: [ExtractedPreview] = []

    for index in 0..<min(pdf.pageCount, limit) {
      guard let page = pdf.page(at: index) else { continue }
      let bounds = page.bounds(for: .mediaBox)
      guard bounds.width > 0, bounds.height > 0 else { continue }

      let file = fileName(for: "page-\(documentId)-\(index)")
      let cached = IslandStore.barcodeURL(file: file)

      if let cached, FileManager.default.fileExists(atPath: cached.path),
         let source = CGImageSourceCreateWithURL(cached as CFURL, nil),
         let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
         let w = props[kCGImagePropertyPixelWidth] as? Int,
         let h = props[kCGImagePropertyPixelHeight] as? Int {
        rendered.append(ExtractedPreview(file: file, uri: cached.absoluteString, width: w, height: h))
        continue
      }

      let scale = longEdge / max(bounds.width, bounds.height)
      let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
      guard let image = page.thumbnail(of: size, for: .mediaBox).cgImage else { continue }

      let written = try write(image: image, documentId: "page-\(documentId)-\(index)")
      guard let fileURL = IslandStore.barcodeURL(file: written) else { continue }
      rendered.append(
        ExtractedPreview(file: written, uri: fileURL.absoluteString, width: image.width, height: image.height)
      )
    }

    log.debug("rendered \(rendered.count) page(s) for \(documentId, privacy: .public)")
    return rendered
  }

  /// Drops every image rendered from a document: the page-one preview and the
  /// full set cached by `pages`.
  ///
  /// The page cache used to be left behind, which mattered little while only
  /// passports were rendered. Now that every document without a code is read as
  /// images, a thrown-away document would otherwise leave up to twelve
  /// full-resolution pages in the App Group for good.
  public static func removePreview(documentId: String) {
    if let url = IslandStore.barcodeURL(file: fileName(for: "preview-\(documentId)")) {
      try? FileManager.default.removeItem(at: url)
    }

    for index in 0..<pageLimit {
      guard let url = IslandStore.barcodeURL(file: fileName(for: "page-\(documentId)-\(index)")) else { continue }
      try? FileManager.default.removeItem(at: url)
    }
  }

  public static func remove(documentId: String) {
    guard let url = IslandStore.barcodeURL(file: fileName(for: documentId)) else { return }
    try? FileManager.default.removeItem(at: url)
  }

  // MARK: - Steps

  private static func normalizedURL(_ path: String) -> URL {
    if path.hasPrefix("file://"), let url = URL(string: path) { return url }
    return URL(fileURLWithPath: path)
  }

  /// Rasterises via PDFKit's own thumbnail renderer.
  ///
  /// Setting up the CTM by hand is a trap here: PDFKit on iOS draws into a
  /// UIKit-oriented (y-down) context, the opposite of a raw `CGContext`. Getting
  /// that backwards produces a *mirrored* page, and a mirrored barcode is not
  /// decodable — Vision just reports no symbol, with nothing to indicate why.
  /// `thumbnail(of:for:)` gets the orientation and any page `/Rotate` right.
  private static func render(page: PDFPage) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    guard bounds.width > 0, bounds.height > 0 else { return nil }

    let scale = scoutLongEdgePoints / max(bounds.width, bounds.height)
    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)

    return page.thumbnail(of: size, for: .mediaBox).cgImage
  }

  /// Redraws the symbol from its decoded payload.
  ///
  /// This is the cleanest possible rendering — pure geometry, no scanned paper,
  /// no half-caught caption text from the page underneath. The catch is that
  /// re-encoding could in principle produce a symbol carrying something other
  /// than the original, so the result is decoded again and only accepted if the
  /// payload comes back byte-for-byte identical. Anything else falls through to
  /// the faithful crop.
  ///
  /// Only the symbologies Core Image can generate are eligible; Data Matrix,
  /// Code 39 and the EAN family have no generator and always use the crop.
  private static func regenerate(from observation: VNBarcodeObservation) -> CGImage? {
    guard
      let text = observation.payloadStringValue,
      !text.isEmpty,
      let message = text.data(using: .isoLatin1) ?? text.data(using: .utf8)
    else { return nil }

    let filterName: String
    switch observation.symbology {
    case .qr: filterName = "CIQRCodeGenerator"
    case .aztec: filterName = "CIAztecCodeGenerator"
    case .pdf417: filterName = "CIPDF417BarcodeGenerator"
    case .code128: filterName = "CICode128BarcodeGenerator"
    default: return nil
    }

    guard let filter = CIFilter(name: filterName) else { return nil }
    filter.setValue(message, forKey: "inputMessage")
    if observation.symbology == .qr {
      // Medium: the payload is what has to survive, and this keeps the modules
      // large enough to stay readable on a phone screen.
      filter.setValue("M", forKey: "inputCorrectionLevel")
    }

    guard let output = filter.outputImage, output.extent.width > 0 else { return nil }

    let scale = symbolTargetPixels / max(output.extent.width, output.extent.height)
    let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

    let context = CIContext()
    guard let rendered = context.createCGImage(scaled, from: scaled.extent) else { return nil }
    guard let padded = withQuietZone(rendered) else { return nil }

    // Prove it still says the same thing before trusting it. The comparison is
    // on the decoded message, not on `payloadData` — that returns the raw
    // encoded segment including the symbology's own mode and length headers, so
    // it never equals the message that was fed in.
    guard
      let check = detect(in: padded),
      check.symbology == observation.symbology,
      check.payloadStringValue == text
    else {
      log.error("regenerated \(observation.symbology.rawValue, privacy: .public) failed verification; using the original crop")
      return nil
    }

    log.debug("regenerated \(observation.symbology.rawValue, privacy: .public) at \(padded.width)x\(padded.height), verified")
    return padded
  }

  /// Core Image emits the symbol flush to its edges; scanners need clear margin.
  private static func withQuietZone(_ image: CGImage) -> CGImage? {
    let padX = Int((CGFloat(image.width) * quietZoneRatio).rounded())
    let padY = Int((CGFloat(image.height) * quietZoneRatio).rounded())
    let width = image.width + padX * 2
    let height = image.height + padY * 2

    guard
      let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
      )
    else { return nil }

    context.interpolationQuality = .none
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    context.draw(image, in: CGRect(x: padX, y: padY, width: image.width, height: image.height))

    return context.makeImage()
  }

  /// Renders just the symbol, at `symbolTargetPixels`, by narrowing the page's
  /// crop box to it and drawing that. Because it goes back to the PDF rather
  /// than enlarging pixels, a vector barcode comes out perfectly sharp at any
  /// size — and it stays the original artwork, not one regenerated from the
  /// decoded payload, which could re-encode it differently.
  private static func highResolutionCrop(of page: PDFPage, boundingBox: CGRect) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    guard bounds.width > 0, bounds.height > 0 else { return nil }

    // Vision's normalised box and PDF user space share a bottom-left origin.
    var rect = CGRect(
      x: bounds.minX + boundingBox.minX * bounds.width,
      y: bounds.minY + boundingBox.minY * bounds.height,
      width: boundingBox.width * bounds.width,
      height: boundingBox.height * bounds.height
    )
    rect = rect.insetBy(dx: -rect.width * quietZoneRatio, dy: -rect.height * quietZoneRatio)
    rect = rect.intersection(bounds)
    guard rect.width > 1, rect.height > 1 else { return nil }

    // In-memory only; the document is never written back.
    let original = page.bounds(for: .cropBox)
    page.setBounds(rect, for: .cropBox)
    defer { page.setBounds(original, for: .cropBox) }

    let scale = symbolTargetPixels / max(rect.width, rect.height)
    let size = CGSize(width: rect.width * scale, height: rect.height * scale)

    return page.thumbnail(of: size, for: .cropBox).cgImage
  }

  private static func detect(in image: CGImage) -> VNBarcodeObservation? {
    let request = VNDetectBarcodesRequest()
    request.symbologies = symbologies

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return nil
    }

    let observations = request.results ?? []
    return observations.max { lhs, rhs in
      let lhsArea = lhs.boundingBox.width * lhs.boundingBox.height
      let rhsArea = rhs.boundingBox.width * rhs.boundingBox.height
      return lhsArea < rhsArea
    }
  }

  /// Vision reports a normalised, bottom-left-origin box; convert to pixels,
  /// pad out the quiet zone, and clamp to the page.
  private static func crop(image: CGImage, to boundingBox: CGRect) -> CGImage? {
    let width = CGFloat(image.width)
    let height = CGFloat(image.height)

    var rect = CGRect(
      x: boundingBox.minX * width,
      y: (1 - boundingBox.maxY) * height,
      width: boundingBox.width * width,
      height: boundingBox.height * height
    )

    let padX = rect.width * quietZoneRatio
    let padY = rect.height * quietZoneRatio
    rect = rect.insetBy(dx: -padX, dy: -padY)
    rect = rect.intersection(CGRect(x: 0, y: 0, width: width, height: height))

    guard rect.width > 8, rect.height > 8 else { return nil }
    return image.cropping(to: rect.integral)
  }

  private static func fileName(for documentId: String) -> String {
    let safe = documentId.replacingOccurrences(
      of: "[^A-Za-z0-9_-]",
      with: "_",
      options: .regularExpression
    )
    return "\(safe).png"
  }

  private static func write(image: CGImage, documentId: String) throws -> String {
    guard let directory = IslandStore.barcodesDirectory else {
      throw BarcodeExtractionError.appGroupUnavailable
    }

    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

    let file = fileName(for: documentId)
    let url = directory.appendingPathComponent(file)

    guard
      let destination = CGImageDestinationCreateWithURL(
        url as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
      )
    else { throw BarcodeExtractionError.writeFailed }

    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
      throw BarcodeExtractionError.writeFailed
    }

    return file
  }

  private static func label(for symbology: VNBarcodeSymbology) -> String {
    switch symbology {
    case .qr: return "QR"
    case .pdf417: return "PDF417"
    case .aztec: return "Aztec"
    case .dataMatrix: return "Data Matrix"
    case .code128: return "Code 128"
    case .code39: return "Code 39"
    case .ean13: return "EAN-13"
    case .ean8: return "EAN-8"
    case .itf14: return "ITF-14"
    default: return "Barcode"
    }
  }
}
