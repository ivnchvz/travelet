import ActivityKit
import Foundation

public enum IslandError: LocalizedError {
  case unsupportedOSVersion
  case activitiesDisabled
  case emptyCatalog
  case requestFailed(String)

  public var errorDescription: String? {
    switch self {
    case .unsupportedOSVersion:
      return "Live Activities require iOS 16.2 or later."
    case .activitiesDisabled:
      return "Live Activities are turned off for Travelet in Settings."
    case .emptyCatalog:
      return "Add a document before opening the island."
    case .requestFailed(let reason):
      return reason
    }
  }
}

/// Single point of control over the Travelet Live Activity.
///
/// Runs in the app process both when JS calls in and when the system executes a
/// `LiveActivityIntent` from an island button.
@available(iOS 16.2, *)
public enum IslandController {
  public static var activity: Activity<TraveletActivityAttributes>? {
    Activity<TraveletActivityAttributes>.activities.first
  }

  public static var isRunning: Bool {
    activity != nil
  }

  public static var areActivitiesEnabled: Bool {
    ActivityAuthorizationInfo().areActivitiesEnabled
  }

  public static func start(categoryIndex: Int) async throws {
    guard areActivitiesEnabled else { throw IslandError.activitiesDisabled }

    let catalog = IslandStore.load()
    guard !catalog.isEmpty else { throw IslandError.emptyCatalog }

    let selection = catalog.resolve(categoryIndex: categoryIndex, documentIndex: 0)
    let state = TraveletActivityAttributes.ContentState(
      categoryIndex: selection.categoryIndex,
      documentIndex: selection.documentIndex
    )

    // Re-requesting would stack a second island; steer the existing one instead.
    if let activity {
      await activity.update(ActivityContent(state: state, staleDate: nil))
      return
    }

    do {
      _ = try Activity.request(
        attributes: TraveletActivityAttributes(),
        content: ActivityContent(state: state, staleDate: nil),
        pushType: nil
      )
    } catch {
      throw IslandError.requestFailed(error.localizedDescription)
    }
  }

  public static func stop() async {
    for activity in Activity<TraveletActivityAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  /// Moves the cursor `delta` documents within the current category.
  public static func stepDocument(by delta: Int) async {
    guard let activity else { return }
    let catalog = IslandStore.load()
    let current = catalog.resolve(
      categoryIndex: activity.content.state.categoryIndex,
      documentIndex: activity.content.state.documentIndex
    )
    let next = catalog.stepDocument(from: current, by: delta)
    await apply(categoryIndex: next.categoryIndex, documentIndex: next.documentIndex, on: activity)
  }

  /// Re-pushes the current cursor so a running island re-reads the catalog.
  /// Call after the app changes its documents — the widget will not pick the
  /// change up on its own. Clamping also pulls the cursor back into range if the
  /// document it was pointing at is gone.
  public static func refresh() async {
    guard let activity else { return }
    let selection = IslandStore.load().resolve(
      categoryIndex: activity.content.state.categoryIndex,
      documentIndex: activity.content.state.documentIndex
    )
    await apply(
      categoryIndex: selection.categoryIndex,
      documentIndex: selection.documentIndex,
      on: activity
    )
  }

  /// Jumps to a category, landing on its first document.
  public static func selectCategory(_ categoryIndex: Int) async {
    guard let activity else { return }
    let selection = IslandStore.load().resolve(categoryIndex: categoryIndex, documentIndex: 0)
    await apply(
      categoryIndex: selection.categoryIndex,
      documentIndex: selection.documentIndex,
      on: activity
    )
  }

  private static func apply(
    categoryIndex: Int,
    documentIndex: Int,
    on activity: Activity<TraveletActivityAttributes>
  ) async {
    // Bumping the revision guarantees the state differs from the last one, so
    // the update always forces a re-render.
    let state = TraveletActivityAttributes.ContentState(
      categoryIndex: categoryIndex,
      documentIndex: documentIndex,
      revision: activity.content.state.revision &+ 1
    )
    await activity.update(ActivityContent(state: state, staleDate: nil))
  }
}
