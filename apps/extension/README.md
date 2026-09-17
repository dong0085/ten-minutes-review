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

`EXT_API_ORIGIN=https://your-deployment.example pnpm build` bakes a different
default server into the manifest (self-hosting). The default is the production
site, `https://ten-minutes-review.vercel.app`; for development against a local
server set the popup's Server field to `http://localhost:3000`.

## Load for development

- Chrome: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
  `dist/firefox/manifest.json`

## Sign in

Two ways, both in the popup:

1. Email + password (the token is minted via `POST /api/auth/token`).
2. Create a token on the web app under Account → API tokens and paste it in —
   the only option for Google-only accounts.

Sign in opens against the production site by default. For local development,
point the popup's Server section at `http://localhost:3000` — a non-default
origin asks for its host permission at that point (Firefox users may need to
grant localhost access there too — Firefox does not auto-grant manifest host
permissions).

Sign out revokes the token server-side and clears local state.

## Icons

`src/icons/*.png` are generated from `apps/web/app/icon.svg` (stores require
raster icons). Regenerate with `qlmanage -t -s <size> -o <dir> icon.svg`.
