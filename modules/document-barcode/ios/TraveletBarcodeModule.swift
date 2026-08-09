import ExpoModulesCore
import TraveletIslandKit

public class TraveletBarcodeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TraveletBarcode")

    // Rasterising a page and running Vision over it is heavy, so this always
    // runs off the JS thread.
    AsyncFunction("extract") { (filePath: String, documentId: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          guard let found = try BarcodeExtractor.extract(from: filePath, documentId: documentId) else {
            promise.resolve(nil)
            return
          }

          promise.resolve([
            "file": found.file,
            "uri": found.uri,
            "payload": found.payload as Any,
            "symbology": found.symbology,
            "page": found.page,
          ])
        } catch {
          promise.reject("ERR_BARCODE", error.localizedDescription)
        }
      }
    }

    // Resolved fresh rather than stored: the App Group container path can change
    // across app updates and restores, which would strand a saved URI.
    // Page one as an image, for documents shown rather than scanned.
    AsyncFunction("preview") { (filePath: String, documentId: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          guard let found = try BarcodeExtractor.preview(from: filePath, documentId: documentId) else {
            promise.resolve(nil)
            return
          }
          promise.resolve([
            "file": found.file,
            "uri": found.uri,
            "width": found.width,
            "height": found.height,
          ])
        } catch {
          promise.reject("ERR_PREVIEW", error.localizedDescription)
        }
      }
    }

    // Every page, for reading the document without a PDF viewer.
    AsyncFunction("pages") { (filePath: String, documentId: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let pages = try BarcodeExtractor.pages(from: filePath, documentId: documentId)
          promise.resolve(pages.map { ["file": $0.file, "uri": $0.uri, "width": $0.width, "height": $0.height] })
        } catch {
          promise.reject("ERR_PAGES", error.localizedDescription)
        }
      }
    }

    Function("removePreview") { (documentId: String) in
      BarcodeExtractor.removePreview(documentId: documentId)
    }

    Function("uriFor") { (file: String) -> String? in
      IslandStore.barcodeURL(file: file)?.absoluteString
    }

    Function("remove") { (documentId: String) in
      BarcodeExtractor.remove(documentId: documentId)
    }
  }
}
