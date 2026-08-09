# App Store submission — travelet

Everything App Store Connect asks for, with the answers already worked out.
Copy-paste territory. Anything marked **TODO** is something only you can supply.

---

## 1. Before you can upload

| Thing | Value / state |
|---|---|
| Bundle ID | `com.wasserstiefel.travelet` |
| Widget extension bundle ID | `com.wasserstiefel.travelet.island` |
| Apple Team ID | `SK2YBWMZ3V` |
| App group | `group.com.wasserstiefel.travelet` |
| EAS project | `53e2bd82-87a3-489f-b678-5ba2849ac54f` |

Both bundle IDs need an App ID in the Developer portal, and **both** need the
**App Groups** capability enabled for `group.com.wasserstiefel.travelet`. If the
extension's profile is missing the group, the app still ships but the Live
Activity silently shows nothing — it reads what the app wrote into the shared
container.

Build and upload:

```
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

`eas.json` is already set to `appVersionSource: "remote"` with `autoIncrement`
on the production profile, so the build number takes care of itself. Marketing
version is `1.0.0` in `app.json`.

---

## 2. Listing

**Name** — `travelet`
(Check availability first. If taken: `travelet — travel wallet`.)

**Subtitle** (30 char max)
```
Your papers, in one place
```

**Promotional text** (170 max, changeable without a review)
```
Passports, boarding passes, visas and insurance — kept as objects you can open,
not files in a list. Everything stays on your phone.
```

**Description**
```
travelet is a wallet for the paperwork of a trip.

Instead of a list of files, your documents live inside objects you open: a
passport you leaf through, a boarding pass you tear, a folder of your own with
whatever else you need. Add a PDF and it takes its place among them.

FLIGHT REMINDERS
Add a boarding pass and travelet reads the flight, gate, seat and times out of
it — in whatever language the airline printed it in — and offers to remind you
the day before, three hours before boarding, and once more before the gate
closes. On the Dynamic Island and Lock Screen, your next flight is where you can
see it.

EVERYTHING STAYS ON YOUR PHONE
There is no account, no sign-up, and no server. travelet makes no network
connections at all. Your documents are copied into the app's own storage and
never leave your device. Nothing is collected, nothing is tracked, and no one —
including us — can see what you keep in it.

WHAT IT HOLDS
· Passports
· Flight tickets and boarding passes
· Visas
· Travel and health insurance
· Customs declarations
· Folders of your own, for anything else

Made for people who would rather have their papers than search for them.
```

**Keywords** (100 characters, comma-separated, no spaces after commas)
```
travel,passport,boarding pass,flight,documents,wallet,visa,itinerary,offline,trip,pdf,organizer
```

**Category** — Primary: **Travel**. Secondary: **Productivity**.

**Copyright** — `2026 <TODO: your legal name or company>`

**Support URL** — **TODO**: where you host `docs/support.html`
**Privacy Policy URL** — **TODO**: where you host `docs/privacy.html`
**Marketing URL** — optional, leave blank

Both pages are in `docs/` in this repo, self-contained with no external assets.
GitHub Pages on this repo is the path of least resistance; the URLs then look
like `https://<user>.github.io/travelet/privacy.html`.

---

## 3. App Privacy questionnaire

Answer: **Data Not Collected.**

That is now literally true — as of this pass the app makes no network requests
at all. The IP-geolocation weather lookup that used to tint the sky is gone
(`services/SkyService.ts`), which was the only thing that ever left the device.
You can prove it in one command:

```
grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|axios" services components app hooks
```

Returns nothing.

The privacy manifests are already in the binary and say the same thing:
`ios/travelet/PrivacyInfo.xcprivacy` and `targets/island/PrivacyInfo.xcprivacy`
both declare `NSPrivacyTracking false` and an empty `NSPrivacyCollectedDataTypes`.

---

## 4. Age rating

Every question is **None**. No violence, no sexual content, no profanity, no
alcohol/tobacco/drugs, no gambling, no horror, no contests, no unrestricted web
access, no user-generated content, no medical or treatment information. Result:
**4+**.

---

## 5. Export compliance

`ITSAppUsesNonExemptEncryption` is `false` in `app.json` and in
`ios/travelet/Info.plist`, so App Store Connect should stop asking. If it does
ask: the app uses no encryption beyond what iOS itself provides, so the answer
is "No" to non-exempt encryption.

---

## 6. App Review notes

This matters more than usual here: **travelet is empty until a document is put
in it.** A reviewer who opens it and taps nothing sees covers and no content.
Paste this into the notes field:

```
No account or sign-in is required — travelet has no server and no login.

The app starts empty on purpose: it holds the reviewer's own documents. To see
it working:

1. On first launch, pick any country when asked. This only decides which country
   is lit on the passport cover's map.
2. Scroll to a category (e.g. "flight tickets") and tap it to open it.
3. Tap the blank dashed sheet at the end of the row.
4. Choose any PDF from Files. Any PDF will do; it is copied into the app.
5. Tap the card that appears to read it full-screen.

For the flight features specifically, use any airline boarding-pass PDF. The app
reads the flight number, gate, seat and times out of the PDF text on-device and
shows them on the card, then asks permission to schedule local reminders before
the flight. The reminders are scheduled by iOS on the device — there is no push
service involved.

To delete a document, drag its card up or down out of the row; a red line marks
the point past which letting go throws it away.

The app makes no network requests of any kind and will behave identically in
airplane mode.
```

---

## 7. Screenshots

**6.9" iPhone (1320 × 2868)** is the only size Apple requires now. Up to 10.
iPad is not needed — `supportsTablet` is `false` for this release.

Shot list, in order:

1. The shelf — several covers in the carousel with their arched titles.
2. A passport open, cards fanned out.
3. A passport card close up — the photograph, stamps, revenue label.
4. A boarding pass card showing an extracted flight: route, gate, seat, times.
5. A flight reminder notification on the Lock Screen, or the Dynamic Island.
6. The folder category — "anything else you need".

Take them on a 16 Pro Max or its simulator. Turn off the status-bar clutter
first: `xcrun simctl status_bar <udid> override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`.

---

## 8. Pre-flight checklist

- [ ] `npx tsc --noEmit` clean
- [ ] `npx expo lint` at baseline (9 problems; 1 pre-existing error in `FilePicker.tsx`)
- [ ] Release build installed on a real device, walked end to end
- [ ] Airplane-mode pass: launch, add a document, open it, delete it
- [ ] Notification permission prompt appears only after a flight is found
- [ ] Live Activity appears on a device running iOS 17+
- [ ] Both `docs/` pages hosted and loading over HTTPS
- [ ] App icon renders correctly at every size (1024×1024, no alpha — verified)
- [ ] Version `1.0.0` in `app.json`; build number left to EAS
