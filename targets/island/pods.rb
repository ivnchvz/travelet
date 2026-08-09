# Links the shared activity model into the widget extension. Paths are relative
# to the Podfile (`ios/`). The app target gets the same pod via
# `plugins/withIslandKit.js`, so both binaries compile one identical module.
pod 'TraveletIslandKit', :path => '../modules/island-kit'
