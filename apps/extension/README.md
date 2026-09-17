# Ten Minute Review browser extension

Save selected text from any web page as a study note: select text, right-click,
"Save selection as note", pick a classroom. The note text keeps a source footer
with the page title and URL.

## Build

```sh
pnpm install
pnpm build            # dist/chrome + dist/firefox
pnpm watch:chrome     # rebuild on change while developing
```

`EXT_API_ORIGIN=http://localhost:3000 pnpm build` targets a local server
instead of the production site; any other origin works the same way
(self-hosting). The origin is baked into both the manifest's host permissions
and the code's base URL, so they can never drift — there is no server setting
in the popup.

## Load for development

- Chrome: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
  `dist/firefox/manifest.json`

## Sign in

Two ways, both in the popup:

1. Email + password (the token is minted via `POST /api/auth/token`).
2. Create a token on the web app under Account → API tokens and paste it in —
   the only option for Google-only accounts.

Sign in opens against the production site by default. Firefox asks for site
access at the first sign-in (it does not auto-grant manifest host permissions);
if access was later removed, the save notification points to the extension's
permissions.

Sign out revokes the token server-side and clears local state.

## Icons

`src/icons/*.png` are generated from `apps/web/app/icon.svg` (stores require
raster icons). Regenerate with `qlmanage -t -s <size> -o <dir> icon.svg`.
