import ExpoModulesCore
import TraveletIslandKit

public class TraveletLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TraveletLiveActivity")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) { return true }
      return false
    }

    Function("areActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.2, *) { return IslandController.areActivitiesEnabled }
      return false
    }

    Function("isRunning") { () -> Bool in
      if #available(iOS 16.2, *) { return IslandController.isRunning }
      return false
    }

    // Mirrors the app's categories into the App Group so the widget process can
    // render them. Cheap enough to call on every change.
    Function("syncCatalog") { (catalogJSON: String) in
      IslandStore.save(catalogJSON: catalogJSON)
    }

    AsyncFunction("start") { (categoryIndex: Int, promise: Promise) in
      guard #available(iOS 16.2, *) else {
        promise.reject("ERR_UNSUPPORTED", IslandError.unsupportedOSVersion.localizedDescription)
        return
      }

      Task {
        do {
          try await IslandController.start(categoryIndex: categoryIndex)
          promise.resolve(nil)
        } catch {
          promise.reject("ERR_LIVE_ACTIVITY", error.localizedDescription)
        }
      }
    }

    // The widget will not notice a changed catalog on its own; this nudges a
    // running activity so it re-renders.
    AsyncFunction("refresh") { (promise: Promise) in
      guard #available(iOS 16.2, *) else {
        promise.resolve(nil)
        return
      }

      Task {
        await IslandController.refresh()
        promise.resolve(nil)
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      guard #available(iOS 16.2, *) else {
        promise.resolve(nil)
        return
      }

      Task {
        await IslandController.stop()
        promise.resolve(nil)
      }
    }
  }
}
