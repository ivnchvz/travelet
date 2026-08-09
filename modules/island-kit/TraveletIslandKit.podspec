Pod::Spec.new do |s|
  s.name           = 'TraveletIslandKit'
  s.version        = '1.0.0'
  s.summary        = 'Shared Live Activity model for Travelet.'
  s.description    = 'Activity attributes, App Group catalog storage, and activity control shared by the Travelet app target and its Dynamic Island widget extension.'
  s.author         = 'Travelet'
  s.homepage       = 'https://github.com/wasserstiefel/travelet'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.swift_version  = '5.9'
  s.static_framework = true
  s.source_files   = 'Sources/**/*.swift'

  # Linked into the widget extension as well as the app, so it must stay within
  # the extension-safe API subset.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'APPLICATION_EXTENSION_API_ONLY' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
