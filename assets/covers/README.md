# Cover artwork

Drop a file here, then uncomment its row in `components/physical/coverArt.ts`.
Anything without a row keeps using the cover drawn in code, so a set can be
replaced one cover at a time.

## Sizes

A cover is `containerWidth × widthPct` wide, and that divided by its aspect
ratio tall (`components/physical/theme.ts`). Container width is the screen
less 20pt. Design to the **ratio** — the pixel sizes below are 3× at a
430pt-wide screen, which leaves headroom on every current device.

| File                | Aspect (w÷h) | Export @3x  | Corner radius |
| ------------------- | ------------ | ----------- | ------------- |
| `passport.png`      | 0.72         | 660 × 917   | 14            |
| `boarding-pass.png` | 2.10         | 1320 × 629  | 16            |
| `visa.png`          | 1.45         | 1320 × 910  | 10            |
| `insurance.png`     | 1.586        | 1267 × 799  | 24            |
| `folder.png`        | 0.84         | 1320 × 1571 | 10            |

The folder is the odd one: its artwork covers the folder **body** only. The tab
along the top and the papers peeking out from behind are structural and stay
drawn in code, so leave them out of the file.

## Export settings

- **PNG, sRGB, 8-bit.** Affinity defaults to Display P3 on a Mac and the
  colours shift once flattened — set the document to sRGB before exporting.
- **Square corners, full bleed.** Each cover is clipped to the radius above
  with `overflow: hidden`. Rounding the artwork as well gives a doubled edge.
- **No drop shadows.** Covers rotate in 3D and the app casts its own shadow; a
  painted one sits at the wrong angle as the cover opens.
- **Bake in the grain.** Any texture in the file replaces the `<Texture>`
  layers, and that's where the performance comes from — an image is one GPU
  texture, where each procedural layer is an SVG surface redrawn per cover.

## Type on the cover

By default the app still draws its labels over the artwork, because the
boarding pass, visa and folder show live data — the category's name and its
document count. Design those with room for it.

If the artwork carries its own lettering, set `content: 'replace'` on its row
and the app draws nothing over it. The passport and insurance covers have no
live data, so they can be replaced outright.

## SVG

`react-native-svg` supports no filters — no Gaussian blur, no noise — and
Affinity rasterises those on export anyway. Use SVG only for a cover that ends
up flat vector: solid shapes and linear or radial gradients, nothing else.
Otherwise PNG.
