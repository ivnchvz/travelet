import ActivityKit
import Foundation

/// Identity of the Live Activity, shared by the app (which starts and updates it)
/// and the widget extension (which renders it).
///
/// The content state holds only cursor indices, never document data — the widget
/// reads the documents themselves from `IslandStore` at render time. That keeps
/// each `activity.update` tiny, which matters because ActivityKit budgets update
/// frequency.
///
/// A Live Activity view only re-renders when its state changes, never because
/// the App Group data changed underneath it. `revision` is bumped on every write
/// so an update always reads as a change, which is what lets the app refresh a
/// running island after documents are added or deleted.
@available(iOS 16.2, *)
public struct TraveletActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var categoryIndex: Int
    public var documentIndex: Int
    public var revision: Int

    public init(categoryIndex: Int = 0, documentIndex: Int = 0, revision: Int = 0) {
      self.categoryIndex = categoryIndex
      self.documentIndex = documentIndex
      self.revision = revision
    }
  }

  public init() {}
}
