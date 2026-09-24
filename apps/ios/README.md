# Ten Minute Review — iOS

A native SwiftUI client for the Ten Minute Review API. Sign in with your
email and password, review today's quiz, add notes from typed text or photos.

## Setup

The Xcode project is generated from `project.yml` — the `.xcodeproj` is
created locally and never committed.

```sh
brew install xcodegen
pnpm ios:generate          # from the repo root, or: xcodegen generate in apps/ios
open TenMinuteReview.xcodeproj
```

## Running against local development

The Debug configuration talks to `http://localhost:3000` (see
`Config/Debug.xcconfig`).

- **Simulator:** works as-is — the simulator shares the Mac loopback. Start
  the web app and worker first (`pnpm dev:web`, `pnpm dev:worker`).
- **Physical device:** replace `localhost` with the Mac's LAN IP (e.g.
  `http://10.0.0.5:3000`) in `Config/Debug.xcconfig`, regenerate, and make
  sure both devices are on the same network. Debug builds allow local HTTP
  through an App Transport Security exception in `SupportFiles/Info-Debug.plist`.

The Release configuration points at the production origin — set it in
`Config/Release.xcconfig` before shipping.

## Signing on a device

Simulator builds need no signing. To run on your iPhone with a free Apple
ID: open the project, select the target, set your team under *Signing &
Capabilities*, and connect the device. Free provisioning re-signs every
seven days — rebuild to refresh.

## Tests

```sh
xcodebuild test \
  -project TenMinuteReview.xcodeproj \
  -scheme TenMinuteReview \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

## Architecture notes

- `Core/Theme` — the app follows native iOS design: stock `List`/`Form` screens, system fonts with Dynamic Type, system backgrounds and status colours. The web palettes (mint, sky, sakura, lavender) supply the app-wide tint, resolved from the same OKLCH `--primary` values as `apps/web/app/globals.css`, and switch live from Account.
- `Core/API` — `APIClient` (bearer token, JSON + multipart), stable error
  codes from the server's `{error, code}` envelope.
- `Core/Auth` — Keychain-stored API token; sign-in mints one via
  `POST /api/auth/token`, sign-out revokes it.
- `Core/Quiz` — `DraftStore` persists in-progress attempts (two-hour window)
  so leaving and relaunching resumes where you were; `OptionOrder` is a port
  of the web client's option shuffle, and submissions always carry original
  option indexes.
- `Core/Images` — note images load through the authenticated loader; upload
  URLs may be relative (`/api/files/...`) or absolute depending on storage.
