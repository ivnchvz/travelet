import Foundation

/// A single document as the Dynamic Island needs to render it. Deliberately a
/// flattened copy of `PDFDocument` from the JS side — the widget process cannot
/// reach the app's sandboxed `PDFs/` directory, so everything it displays has to
/// travel through the App Group.
public struct IslandDocument: Codable, Hashable, Identifiable {
  public let id: String
  public let name: String
  public let traveler: String
  public let fileSize: String
  /// Filename of the cropped barcode inside the App Group, if the document had
  /// one. Stored as a bare name so it resolves in either process.
  public let barcodeFile: String?
  /// Vision symbology, e.g. "PDF417" or "QR" — shown as a caption.
  public let barcodeSymbology: String?

  public init(
    id: String,
    name: String,
    traveler: String,
    fileSize: String,
    barcodeFile: String? = nil,
    barcodeSymbology: String? = nil
  ) {
    self.id = id
    self.name = name
    self.traveler = traveler
    self.fileSize = fileSize
    self.barcodeFile = barcodeFile
    self.barcodeSymbology = barcodeSymbology
  }

  public var hasBarcode: Bool { barcodeFile != nil }
}

public struct IslandCategory: Codable, Hashable, Identifiable {
  public let id: String
  public let name: String
  /// `#rrggbb` accent pulled from the category's physical-object theme.
  public let tint: String
  public let documents: [IslandDocument]

  public init(id: String, name: String, tint: String, documents: [IslandDocument]) {
    self.id = id
    self.name = name
    self.tint = tint
    self.documents = documents
  }
}

public struct IslandCatalog: Codable {
  public let categories: [IslandCategory]

  public init(categories: [IslandCategory]) {
    self.categories = categories
  }

  public static let empty = IslandCatalog(categories: [])

  public var isEmpty: Bool { categories.isEmpty }
}

/// The catalog entry the island is currently pointing at, with both indices
/// already clamped to whatever the catalog actually holds.
public struct IslandSelection {
  public let categoryIndex: Int
  public let documentIndex: Int
  public let category: IslandCategory?
  public let document: IslandDocument?
  public let documentCount: Int
  public let categoryCount: Int
  /// Position among *all* documents, which is what the arrows now walk through.
  public let overallIndex: Int
  public let overallCount: Int

  public var isEmpty: Bool { document == nil }

  /// 1-based position for display, e.g. "2 of 5". Counts every document in the
  /// app, matching what stepping actually does — a per-category count would
  /// stop at 2 while the arrows carried on past it.
  public var displayPosition: String {
    guard overallCount > 0 else { return "empty" }
    return "\(overallIndex + 1) of \(overallCount)"
  }
}

extension IslandCatalog {
  /// Resolves raw indices against the current catalog. The activity's state and
  /// the stored catalog are updated independently — a document can be deleted
  /// while the activity is live — so every read goes through here rather than
  /// subscripting directly.
  public func resolve(categoryIndex: Int, documentIndex: Int) -> IslandSelection {
    guard !categories.isEmpty else {
      return IslandSelection(
        categoryIndex: 0,
        documentIndex: 0,
        category: nil,
        document: nil,
        documentCount: 0,
        categoryCount: 0,
        overallIndex: 0,
        overallCount: 0
      )
    }

    let safeCategoryIndex = min(max(categoryIndex, 0), categories.count - 1)
    let category = categories[safeCategoryIndex]
    let documents = category.documents

    guard !documents.isEmpty else {
      return IslandSelection(
        categoryIndex: safeCategoryIndex,
        documentIndex: 0,
        category: category,
        document: nil,
        documentCount: 0,
        categoryCount: categories.count,
        overallIndex: 0,
        overallCount: runningOrder.count
      )
    }

    let safeDocumentIndex = min(max(documentIndex, 0), documents.count - 1)
    let order = runningOrder
    let overall =
      order.firstIndex { $0.category == safeCategoryIndex && $0.document == safeDocumentIndex } ?? 0

    return IslandSelection(
      categoryIndex: safeCategoryIndex,
      documentIndex: safeDocumentIndex,
      category: category,
      document: documents[safeDocumentIndex],
      documentCount: documents.count,
      categoryCount: categories.count,
      overallIndex: overall,
      overallCount: order.count
    )
  }

  /// Moves `delta` documents through *every* document in the app, crossing from
  /// one category into the next at the boundaries and wrapping around at the
  /// ends.
  ///
  /// The expanded island has no room for category chips once the code is shown
  /// at a useful size, so the arrows have to be able to reach everything on
  /// their own — stepping only within the current category would strand you in
  /// whichever one the activity happened to start in.
  public func stepDocument(from selection: IslandSelection, by delta: Int) -> (categoryIndex: Int, documentIndex: Int) {
    let order = runningOrder
    guard !order.isEmpty else { return (selection.categoryIndex, 0) }

    let current =
      order.firstIndex { $0.category == selection.categoryIndex && $0.document == selection.documentIndex } ?? 0
    let next = ((current + delta) % order.count + order.count) % order.count

    return (order[next].category, order[next].document)
  }

  /// Every document, flattened in the order the categories appear.
  public var runningOrder: [(category: Int, document: Int)] {
    categories.enumerated().flatMap { categoryIndex, category in
      category.documents.indices.map { (category: categoryIndex, document: $0) }
    }
  }

  /// The chips shown along the bottom of the expanded island. There is only room
  /// for a handful, so the window slides to keep the selected category visible.
  public func chipWindow(around categoryIndex: Int, limit: Int) -> [(index: Int, category: IslandCategory)] {
    guard !categories.isEmpty else { return [] }
    guard categories.count > limit else {
      return categories.enumerated().map { ($0.offset, $0.element) }
    }

    var start = categoryIndex - limit / 2
    start = min(max(start, 0), categories.count - limit)
    return (start..<(start + limit)).map { ($0, categories[$0]) }
  }
}

/// Shared App Group storage. The app writes the catalog on every change; the
/// widget extension only ever reads it.
public enum IslandStore {
  public static let appGroup = "group.com.wasserstiefel.travelet"

  private static let catalogKey = "travelet.island.catalog"

  private static var defaults: UserDefaults? {
    UserDefaults(suiteName: appGroup)
  }

  /// Barcode crops live in the App Group container rather than the app sandbox,
  /// because the widget process has to read them and cannot reach the sandbox.
  public static var barcodesDirectory: URL? {
    guard
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
    else { return nil }
    return container.appendingPathComponent("barcodes", isDirectory: true)
  }

  public static func barcodeURL(file: String?) -> URL? {
    guard let file, !file.isEmpty, let directory = barcodesDirectory else { return nil }
    return directory.appendingPathComponent(file)
  }

  public static func save(catalogJSON: String) {
    defaults?.set(catalogJSON, forKey: catalogKey)
  }

  public static func load() -> IslandCatalog {
    guard
      let json = defaults?.string(forKey: catalogKey),
      let data = json.data(using: .utf8),
      let catalog = try? JSONDecoder().decode(IslandCatalog.self, from: data)
    else {
      return .empty
    }
    return catalog
  }

  /// Deep link back into the app. Lands on the root route, where the index
  /// screen picks the ids up as search params and opens the document peek.
  public static func deepLink(category: IslandCategory?, document: IslandDocument?) -> URL? {
    guard let category, let document else { return URL(string: "travelet:///") }
    var components = URLComponents()
    components.scheme = "travelet"
    components.host = ""
    components.path = "/"
    components.queryItems = [
      URLQueryItem(name: "cat", value: category.id),
      URLQueryItem(name: "doc", value: document.id),
    ]
    return components.url
  }
}
