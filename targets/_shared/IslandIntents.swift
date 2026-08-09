import AppIntents
import Foundation
import TraveletIslandKit

/// Buttons in the expanded Dynamic Island.
///
/// These live in `targets/_shared` so the file is compiled into *both* the app
/// target and the widget extension: the extension needs the types to build the
/// `Button(intent:)` views, and the app needs them because `LiveActivityIntent`
/// is executed in the app's process (which is also the only process allowed to
/// call `activity.update`).
///
/// This is the one interaction model the Dynamic Island supports. There is no
/// `ScrollView`, `TextField`, or gesture recognizer available inside a Live
/// Activity, so paging happens one button tap at a time.

/// Steps forward/backward through the documents in the selected category.
@available(iOS 17.0, *)
public struct IslandStepDocumentIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Browse Travelet Documents"
  public static var description = IntentDescription("Moves to the next or previous document in the selected category.")
  public static var isDiscoverable: Bool = false

  @Parameter(title: "Delta")
  public var delta: Int

  public init() {}

  public init(delta: Int) {
    self.delta = delta
  }

  public func perform() async throws -> some IntentResult {
    await IslandController.stepDocument(by: delta)
    return .result()
  }
}

/// Switches which category the island is browsing.
@available(iOS 17.0, *)
public struct IslandSelectCategoryIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Select Travelet Category"
  public static var description = IntentDescription("Switches the Dynamic Island to a different document category.")
  public static var isDiscoverable: Bool = false

  @Parameter(title: "Category Index")
  public var categoryIndex: Int

  public init() {}

  public init(categoryIndex: Int) {
    self.categoryIndex = categoryIndex
  }

  public func perform() async throws -> some IntentResult {
    await IslandController.selectCategory(categoryIndex)
    return .result()
  }
}
