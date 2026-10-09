# Setup, for the parts only the author can do

This session could not create the GitHub repo (the GitHub integration here
has no permission to create repositories) and has no Cloudflare
credentials, so the repo was built locally and these steps finish the
wiring. Nothing here asks for a key to be given to a session.

## 1. The repo

1. On GitHub, create the private repo `SnapHit/drift-fever-crazygames`,
   empty: no README, no .gitignore, no licence.
2. Push this repo's `main` into it. The session delivered the history as a
   bundle file; from a machine with the bundle:

   ```
   git clone drift-fever-crazygames.bundle drift-fever-crazygames
   cd drift-fever-crazygames
   git remote set-url origin git@github.com:SnapHit/drift-fever-crazygames.git
   git push -u origin main
   ```

   Or, if a Claude session has the new repo attached, ask it to push the
   same `main`.
3. Give the Claude GitHub app access to the new repo (GitHub Settings,
   Applications, Claude, Repository access), so future sessions can push.
4. GitHub Actions needs nothing: the parity workflow uses no secrets.

## 2. The deploy, Cloudflare Workers Builds

1. Cloudflare dashboard, Workers & Pages, Create, Import a repository,
   pick `SnapHit/drift-fever-crazygames`.
2. Project name `drift-fever-crazygames`, production branch `main`.
3. Build command: `npm ci && npm run build`
   Deploy command: `npx wrangler deploy`
   Root directory: `/`
4. Save and deploy. The first build runs the stamp check and assembles
   `dist/`. The preview is `https://drift-fever-crazygames.<your
   subdomain>.workers.dev`.

Every later push to `main` builds and deploys the same way. No API token
is created, stored or needed anywhere.

## 3. Keeping the preview private, Cloudflare Access

1. Cloudflare dashboard, Zero Trust, Access, Applications, Add an
   application, Self-hosted.
2. Application domain: the `workers.dev` hostname from step 2.
3. Policy: Allow, include Emails, your address. Identity provider: One-time
   PIN (the default, needs no setup).
4. Save. Opening the preview now asks for a PIN sent to that email, once
   per device, and the game itself is unchanged.

That is the private preview URL to play on a phone.
