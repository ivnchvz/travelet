Pod::Spec.new do |s|
  s.name           = 'TraveletBarcode'
  s.version        = '1.0.0'
  s.summary        = 'Extracts ticket barcodes out of PDFs.'
  s.description    = 'Rasterises PDF pages with PDFKit and locates QR / PDF417 / Aztec symbols with Vision, keeping a high-resolution crop in the App Group.'
  s.author         = 'Travelet'
  s.homepage       = 'https://github.com/wasserstiefel/travelet'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.swift_version  = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'TraveletIslandKit'

  s.frameworks = 'PDFKit', 'Vision', 'ImageIO', 'CoreGraphics'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
