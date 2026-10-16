# Setup, for the parts only the author can do

This folder is a second build inside the Drift_Fever repository. Nothing
here is served by the live Worker: `.assetsignore` at the repository root
is an allowlist and `crazygames/` is not on it, so driftfever.com returns
404 for `/crazygames/`. The preview is a second Cloudflare Worker that
imports the same repository with its root directory set to `crazygames/`.
No API token is created, stored or needed anywhere, and nothing here asks
for a key to be given to a session.

## 1. The preview Worker, Cloudflare Workers Builds

1. Cloudflare dashboard, Workers & Pages, Create, Import a repository,
   pick `SnapHit/Drift_Fever` (the same repository the live site deploys
   from).
2. Project name `drift-fever-crazygames`, production branch `main`.
3. Build configuration:
   Root directory: `crazygames`
   Build command: `npm ci && npm run build`
   Deploy command: `npx wrangler deploy`
4. Save and deploy. The build runs the parity stamp check and assembles
   `dist/`; `crazygames/wrangler.jsonc` names the Worker and points its
   assets directory at `dist/`. The preview is
   `https://drift-fever-crazygames.<your subdomain>.workers.dev`.

Every later push to `main` builds both Workers: the live site from the
repository root as before, the preview from `crazygames/`. A push that
touches only `crazygames/` still rebuilds the live Worker, and it publishes
the same eighteen files it always has; `crazygames/` is not on the
allowlist.

The deploy build does not run the browser parity test itself, because the
Workers build image is not guaranteed to have Chromium. It checks the
committed stamp instead: a push that changes the module, the original's
pin or the test without a fresh passing stamp does not deploy. The test also
runs live in GitHub Actions, `/.github/workflows/crazygames-parity.yml`,
enabled 16 October 2026.

## 2. Keeping the preview private, Cloudflare Access (not used)

Skipped by the author's decision on 16 October 2026: the preview is public
and unlisted. The steps stay here in case that changes.


1. Cloudflare dashboard, Zero Trust, Access, Applications, Add an
   application, Self-hosted.
2. Application domain: the `workers.dev` hostname from step 1.
3. Policy: Allow, include Emails, your address. Identity provider: One-time
   PIN (the default, needs no setup).
4. Save. Opening the preview now asks for a PIN sent to that email, once
   per device, and the game itself is unchanged.

That is the private preview URL to play on a phone.
