import ActivityKit
import AppIntents
import SwiftUI
import TraveletIslandKit
import WidgetKit

/// Maximum number of category chips that fit across the bottom of the expanded
/// island without the labels collapsing.
private let chipLimit = 4

struct TraveletLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TraveletActivityAttributes.self) { context in
      LockScreenView(selection: resolve(context.state))
        .activityBackgroundTint(Color.black.opacity(0.55))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      let selection = resolve(context.state)

      return DynamicIsland {
        // The top row shares its band with the camera, so it carries only
        // labels. Everything vertical is spent on the code below.
        DynamicIslandExpandedRegion(.leading) {
          Text(selection.category?.name ?? "Travelet")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(selection.tint)
            .lineLimit(1)
            .padding(.leading, 4)
        }

        DynamicIslandExpandedRegion(.trailing) {
          Text(selection.displayPosition)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(.secondary)
            .padding(.trailing, 4)
        }

        DynamicIslandExpandedRegion(.bottom) {
          PassBody(selection: selection, maxCodeHeight: 108)
        }
      } compactLeading: {
        Image(systemName: "airplane")
          .foregroundStyle(selection.tint)
      } compactTrailing: {
        Text(selection.documentCount > 0 ? "\(selection.documentCount)" : "—")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(selection.tint)
      } minimal: {
        Image(systemName: "doc.text.fill")
          .foregroundStyle(selection.tint)
      }
      .widgetURL(selection.deepLink)
      .keylineTint(selection.tint)
    }
  }

  /// The activity state carries only indices — the documents themselves come
  /// from the App Group at render time.
  private func resolve(_ state: TraveletActivityAttributes.ContentState) -> IslandSelection {
    IslandStore.load().resolve(
      categoryIndex: state.categoryIndex,
      documentIndex: state.documentIndex
    )
  }
}

// MARK: - Pieces

private struct StepButton: View {
  let delta: Int
  let systemImage: String
  let tint: Color
  /// 44pt is Apple's minimum touch target. Anything smaller and a near-miss
  /// falls through to the Live Activity itself, which opens the app — on a
  /// locked phone that means being dumped at the passcode screen.
  var size: CGFloat = 44

  var body: some View {
    Button(intent: IslandStepDocumentIntent(delta: delta)) {
      Image(systemName: systemImage)
        .font(.system(size: 17, weight: .bold))
        .foregroundStyle(tint)
        .frame(width: size, height: size)
        .background(tint.opacity(0.18), in: Circle())
        // Rectangle, not Circle: the corners of the frame stay tappable, so a
        // slightly-off tap still hits the button instead of the card behind it.
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}

/// A scannable symbol rendered on white, with the quiet zone the crop already
/// carries. Always light, never theme-tinted — scanners need the contrast.
private struct BarcodeView: View {
  let image: UIImage
  let maxHeight: CGFloat
  /// Left unset so wide symbologies (PDF417, Code 128) span the full width
  /// available — constraining them to a square is what makes a boarding pass
  /// come out far smaller than it needs to be.
  var maxWidth: CGFloat?
  var cornerRadius: CGFloat = 6

  var body: some View {
    Image(uiImage: image)
      // Without this the fully-opaque code is treated as a template and filled
      // flat with the foreground colour — which is why it came out as a plain
      // grey square rather than a barcode.
      .renderingMode(.original)
      .resizable()
      .interpolation(.none) // keep module edges crisp instead of smearing them
      .aspectRatio(contentMode: .fit)
      .frame(maxWidth: maxWidth ?? .infinity, maxHeight: maxHeight)
      .padding(4)
      .background(Color.white, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
  }
}

/// The document itself. Tapping opens it in the app.
private struct DocumentRow: View {
  let selection: IslandSelection

  var body: some View {
    if let document = selection.document {
      Link(destination: selection.deepLink ?? URL(string: "travelet:///")!) {
        HStack(spacing: 8) {
          // The thumbnail is an affordance, not something to scan — it says
          // "this pass has a code" and sends you to the full-size one.
          if let barcode = selection.barcodeImage {
            BarcodeView(image: barcode, maxHeight: 34, maxWidth: 34, cornerRadius: 5)
          } else {
            Image(systemName: "doc.text.fill")
              .font(.system(size: 16))
              .foregroundStyle(selection.tint)
          }

          VStack(alignment: .leading, spacing: 1) {
            Text(document.name)
              .font(.system(size: 14, weight: .semibold))
              .foregroundStyle(.white)
              .lineLimit(1)
            Text(subtitle(for: document))
              .font(.system(size: 11))
              .foregroundStyle(.white.opacity(0.6))
              .lineLimit(1)
          }

          Spacer(minLength: 4)

          Image(systemName: "arrow.up.forward")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.white.opacity(0.5))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Color.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
      }
      .buttonStyle(.plain)
    } else {
      Text(selection.category == nil ? "No documents yet" : "\(selection.category!.name) is empty")
        .font(.system(size: 12))
        .foregroundStyle(.white.opacity(0.6))
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
    }
  }

  private func subtitle(for document: IslandDocument) -> String {
    [document.traveler, document.fileSize]
      .filter { !$0.isEmpty }
      .joined(separator: " · ")
  }
}

private struct CategoryChips: View {
  let selection: IslandSelection

  var body: some View {
    let chips = IslandStore.load().chipWindow(around: selection.categoryIndex, limit: chipLimit)

    if chips.count > 1 {
      HStack(spacing: 5) {
        ForEach(chips, id: \.index) { chip in
          let isSelected = chip.index == selection.categoryIndex
          let tint = Color(islandHex: chip.category.tint)

          Button(intent: IslandSelectCategoryIntent(categoryIndex: chip.index)) {
            Text(chip.category.name)
              .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
              .foregroundStyle(isSelected ? tint : .white.opacity(0.55))
              .lineLimit(1)
              .minimumScaleFactor(0.8)
              .padding(.horizontal, 8)
              .padding(.vertical, 5)
              .frame(maxWidth: .infinity)
              .background(
                Capsule().fill(isSelected ? tint.opacity(0.2) : Color.white.opacity(0.08))
              )
          }
          .buttonStyle(.plain)
        }
      }
    }
  }
}

/// Shown on the Lock Screen and in the banner, and on devices without a Dynamic
/// Island. This is the surface a pass is actually held up from — it's
/// persistent, so unlike the island it doesn't need a finger held on it.
///
/// The system caps this at 160pt tall, and height is the only thing that limits
/// how large a code can be shown, so the layout follows the code's shape:
///
///  - A square code (QR, Aztec, Data Matrix) leaves most of the card's width
///    empty. The details move into that dead space beside it so the code can use
///    the full height rather than sharing it with a caption and chips.
///  - A wide code (PDF417, Code 128) wants the width instead, so it spans the
///    card and the details sit underneath.
private struct LockScreenView: View {
  let selection: IslandSelection

  var body: some View {
    PassBody(selection: selection, maxCodeHeight: 120)
      .padding(10)
  }
}

/// The code and its details, shared by the Lock Screen and the expanded island.
///
/// Both surfaces are capped at the same 160pt by the system, so the island can
/// show the code at very nearly the size the Lock Screen does — the only
/// difference is the band the sensor housing occupies, which the island has to
/// give up and the Lock Screen does not.
private struct PassBody: View {
  let selection: IslandSelection
  let maxCodeHeight: CGFloat

  /// Above this width:height a code counts as "wide" and gets the full width.
  private let wideAspectThreshold: CGFloat = 1.6

  var body: some View {
    Group {
      if let barcode = selection.barcodeImage {
        let aspect = barcode.size.width / max(barcode.size.height, 1)

        if aspect < wideAspectThreshold {
          squareLayout(barcode)
        } else {
          wideLayout(barcode)
        }
      } else {
        browsingLayout
      }
    }
  }

  /// Code on the left at full height, details in the space it can't use.
  private func squareLayout(_ barcode: UIImage) -> some View {
    HStack(spacing: 8) {
      StepButton(delta: -1, systemImage: "chevron.left", tint: selection.tint)
      BarcodeView(image: barcode, maxHeight: maxCodeHeight, cornerRadius: 8)
      details
      StepButton(delta: 1, systemImage: "chevron.right", tint: selection.tint)
    }
  }

  /// A wide code spans the card. The arrows sit beside it rather than below, so
  /// they cost no vertical budget and the caption gets its own line.
  private func wideLayout(_ barcode: UIImage) -> some View {
    VStack(spacing: 4) {
      HStack(spacing: 8) {
        StepButton(delta: -1, systemImage: "chevron.left", tint: selection.tint)
        BarcodeView(image: barcode, maxHeight: maxCodeHeight * 0.74, cornerRadius: 8)
        StepButton(delta: 1, systemImage: "chevron.right", tint: selection.tint)
      }

      Text(inlineCaption)
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(.white.opacity(0.75))
        .lineLimit(1)
    }
  }

  private var inlineCaption: String {
    [
      selection.document?.name,
      selection.document?.traveler,
      selection.displayPosition,
    ]
    .compactMap { $0 }
    .filter { !$0.isEmpty }
    .joined(separator: " · ")
  }

  private var details: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(selection.category?.name ?? "Travelet")
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(selection.tint)
        .lineLimit(1)

      if let document = selection.document {
        Text(document.name)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(2)

        if !document.traveler.isEmpty {
          Text(document.traveler)
            .font(.system(size: 11))
            .foregroundStyle(.white.opacity(0.7))
            .lineLimit(1)
        }
      }

      Spacer(minLength: 0)

      Text(
        [selection.document?.barcodeSymbology, selection.displayPosition]
          .compactMap { $0 }
          .joined(separator: " · ")
      )
      .font(.system(size: 10))
      .foregroundStyle(.white.opacity(0.5))
      .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var browsingLayout: some View {
    VStack(spacing: 6) {
      HStack {
        Label(selection.category?.name ?? "Travelet", systemImage: "airplane")
          .font(.caption.weight(.semibold))
          .foregroundStyle(selection.tint)
        Spacer()
        Text(selection.displayPosition)
          .font(.caption2)
          .foregroundStyle(.white.opacity(0.6))
      }

      HStack(spacing: 10) {
        StepButton(delta: -1, systemImage: "chevron.left", tint: selection.tint)
        DocumentRow(selection: selection)
        StepButton(delta: 1, systemImage: "chevron.right", tint: selection.tint)
      }

      CategoryChips(selection: selection)
    }
  }
}
