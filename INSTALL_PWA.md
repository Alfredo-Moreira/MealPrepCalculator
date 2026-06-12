# Installing MacroLeaf on Android (PWA)

MacroLeaf is a Progressive Web App, so it installs to the home screen and runs full-screen like
a native app — no Play Store needed.

## ⚠️ Prerequisite: serve it over HTTPS

A PWA is only **installable** (service worker, offline, proper "Install app" prompt) from a
**secure context**. That means the app must be reached over **`https://…`** (or `localhost`,
which doesn't apply to a phone). Plain `http://192.168.x.x` will only create a basic shortcut —
no offline, opens in a browser tab.

Pick one way to get HTTPS in front of the app (the Express server listens on port `3001`):

| Option | Best for | Notes |
| --- | --- | --- |
| **Tailscale + `tailscale serve`** *(recommended for the two of you)* | Private access from anywhere, no public exposure | Install Tailscale on the NAS + both phones, then `tailscale serve https / http://localhost:3001`. You get an HTTPS URL like `https://nas.<tailnet>.ts.net`. Trusted cert, nothing exposed to the internet. |
| **NAS reverse proxy + Let's Encrypt** (Synology/QNAP have this built in) | A real domain via DDNS | Point a (sub)domain at the NAS, issue a cert, reverse-proxy `→ localhost:3001`. |
| **Cloudflare Tunnel** | Public HTTPS without port-forwarding | `cloudflared` tunnel to `localhost:3001`; gives an HTTPS hostname. |

Avoid a self-signed cert for installs — Chrome treats untrusted certs as insecure and won't
offer to install the PWA.

> Whichever you choose, open the app once in Chrome at its **`https://`** URL and confirm there's
> no certificate warning before trying to install.

## Install steps (Android / Chrome)

1. Open **Chrome** on the phone and go to the app's **`https://`** URL.
2. You'll usually see an **"Install app" / "Add to Home screen"** banner. If not, tap the
   **⋮ menu (top-right) → Install app** (or **Add to Home screen**).
3. Confirm **Install**. The MacroLeaf leaf icon appears on the home screen / app drawer.
4. Launch it from the icon — it opens **full-screen** (no address bar), with the splash screen,
   and works offline for already-loaded screens.

(Other Android browsers: Samsung Internet → **≡ menu → Add page to → Home screen**. Firefox
supports "Install" too. Chrome gives the best PWA experience.)

## Using it as two people

- **Each phone installs the app independently** (repeat the steps above on both).
- Inside the app, the home screen lists **users** — create one profile per person and open yours.
- Optionally set a **PIN** when creating your user so your profile stays private on a shared
  phone. (It's a soft lock for separation, not strong security — anyone with network/DB access
  can still read the data.)
- All data lives on the NAS, so both installs see the same plans and progress in sync.

## Updates

The app is configured with `autoUpdate` — when you deploy a new build to the NAS, installed
phones pick up the new version automatically on next launch (it refreshes in the background).
No reinstall needed.

## Troubleshooting

- **No "Install app" option** → you're almost certainly on `http://` or an untrusted cert. Confirm
  the URL is `https://` with no cert warning (see prerequisite above).
- **Installs but opens in a browser tab / no offline** → service worker didn't register; same
  HTTPS cause.
- **Camera/barcode scan doesn't work** → camera access also requires HTTPS; grant the camera
  permission when prompted. (Barcode scanning is Chromium-only; on other browsers use the manual
  barcode entry box.)
- **Stuck on an old version** → from the installed app, pull-to-refresh, or clear the app's cache
  in Android **Settings → Apps → MacroLeaf → Storage**.
