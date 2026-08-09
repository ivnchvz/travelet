Pod::Spec.new do |s|
  s.name           = 'TraveletLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'JS bridge for the Travelet Dynamic Island Live Activity.'
  s.description    = 'Exposes start/stop/sync control over the Travelet Live Activity to React Native.'
  s.author         = 'Travelet'
  s.homepage       = 'https://github.com/wasserstiefel/travelet'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.swift_version  = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'TraveletIslandKit'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
