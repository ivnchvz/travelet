/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "island",
  displayName: "Travelet Island",
  // Interactive buttons inside a Live Activity (`Button(intent:)` /
  // `LiveActivityIntent`) are iOS 17+.
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AppIntents"],
  colors: {
    $accent: "#2563eb",
    $widgetBackground: "#0b1220",
  },
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
