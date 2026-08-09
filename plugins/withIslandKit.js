const { withPodfile } = require("expo/config-plugins");

const POD_LINE = `  pod 'TraveletIslandKit', :path => '../modules/island-kit'`;

/**
 * Links the shared Live Activity model into the main app target.
 *
 * The widget extension gets the same pod through `targets/island/pods.rb`, but
 * CocoaPods needs the app target to declare it too: `TraveletLiveActivity`
 * depends on it, and the `:path` external source has to be resolvable from the
 * Podfile.
 */
module.exports = function withIslandKit(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes("modules/island-kit")) {
      return config;
    }

    // Insert at the top of the main app target block.
    const targetPattern = /^(target ['"][^'"]+['"] do\s*$)/m;
    if (!targetPattern.test(contents)) {
      throw new Error(
        "withIslandKit: could not find the main target block in the Podfile."
      );
    }

    config.modResults.contents = contents.replace(
      targetPattern,
      `$1\n${POD_LINE}`
    );

    return config;
  });
};
