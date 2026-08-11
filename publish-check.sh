#!/bin/sh
# THE LIVE SITE, CHECKED AGAINST THIS REPOSITORY.
#
#   ./publish-check.sh
#
# WHAT THIS IS FOR, AND WHY THE LAST VERSION WAS USELESS. It had 48
# checks and it did not notice that the site had been frozen three
# sessions behind, that deploys had been failing for days, or that
# /.git was being served. It was written against GitHub Pages and Pages
# stopped being the host. Every check in it was about what Jekyll would
# publish out of a repository, and Jekyll never ran.
#
# THE SITE IS A CLOUDFLARE WORKER. wrangler.jsonc points the assets
# directory at the repository root, driftfever.com and www are custom
# domains on it, and `npx wrangler deploy` is the deploy. What reaches
# the web is decided by .assetsignore, which is an allowlist.
#
# THE FIRST CHECK IS THE ONE THAT MATTERS. It compares the live
# index.html against the one in this working tree, by byte count. Two
# numbers. If they differ the deploy has not landed, and that single
# line would have caught the frozen site, the failed builds and the
# stale content together. Everything after it assumes the site is
# current; if the first check fails, fix that before reading the rest.
#
# Two optional arguments, both for testing this script rather than the
# site: where to fetch from, and what the canonical tags should say.
#
#   ./publish-check.sh http://127.0.0.1:8799 https://driftfever.com
#
# curl and grep. Nothing else, so it runs anywhere.

BASE="${1:-https://driftfever.com}"
CANON="${2:-https://driftfever.com}"
BASE="${BASE%/}"
CANON="${CANON%/}"
HERE=$(dirname "$0")

pass=0
fail=0
ok()  { pass=$((pass+1)); printf '  ok    %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL  %s\n' "$1"; }

PATHS="/
/car-games-online/
/where-to-play-drift-hunters/
/browser-games-official-sites/
/drift-boss-one-button-games/
/racing-games-online/
/drift-games-online/
/driving-games-online/"

# ------------------------------------------------------------------
printf '\n== IS THE LIVE SITE THIS BUILD\n\n'
LOCAL=$(wc -c < "$HERE/index.html" | tr -d ' ')
# --compressed, so the number is the decoded size whatever the Worker
# chose to do on the wire, which is what makes it comparable to a file
# on disk at all.
LIVE=$(curl -sS --compressed "$BASE/" | wc -c | tr -d ' ')
printf '  repo index.html %s bytes\n  live index.html %s bytes\n' "$LOCAL" "$LIVE"
if [ "$LOCAL" = "$LIVE" ]; then
  ok "the live game is this build"
else
  bad "THE DEPLOY HAS NOT LANDED. live $LIVE, repo $LOCAL, difference $((LIVE - LOCAL))"
  printf '        run: npx wrangler deploy\n'
  printf '        everything below is measured against a stale site.\n'
fi

# WHO IS ANSWERING, printed rather than asserted. The whole of this
# session was caused by nobody knowing which host was serving the
# domain, so the answer goes on the report every time.
SRV=$(curl -sSI "$BASE/" | tr -d '\r' | grep -iE '^(server|cf-ray|x-served-by|via):' | head -3)
printf '  answering:\n%s\n' "$(printf '%s' "$SRV" | sed 's/^/        /')"

# IS ANYBODY ELSE STILL SERVING THIS REPOSITORY. The root cause of the
# outage this script was rewritten after was two hosts configured for one
# repository and nobody knowing which one the domain pointed at. A second
# live copy is also a second copy of everything this repository contains,
# under whatever rules THAT host has rather than .assetsignore.
printf '\n== IS ANYTHING ELSE SERVING THIS REPO\n\n'
GH=$(curl -sSL -o /dev/null -w '%{http_code}' --max-time 15 \
     "https://snaphit.github.io/Drift_Fever/" 2>/dev/null)
case "$GH" in
  # 000 IS NOT A PASS. It means curl could not connect at all, which is
  # a blocked network as often as it is a host that is really gone, and
  # a check that goes green because it could not run is the exact shape
  # of the failure this script was rewritten after.
  000) printf '  ????  could not reach snaphit.github.io at all. NOT checked.\n'
       printf '        Confirm by hand that GitHub Pages is off for this repo.\n' ;;
  404) ok "the old GitHub Pages copy is gone (404)" ;;
  *) bad "GitHub Pages is STILL SERVING this repo ($GH)"
     printf '        https://snaphit.github.io/Drift_Fever/\n'
     printf '        Two hosts for one repository is what caused the outage.\n'
     printf '        Turn Pages off in the repository settings.\n'
     GHMD=$(curl -sSL -o /dev/null -w '%{http_code}' --max-time 15 \
            "https://snaphit.github.io/Drift_Fever/BRIEF.md" 2>/dev/null)
     [ "$GHMD" = "200" ] && printf '        And it is serving BRIEF.md (%s).\n' "$GHMD" ;;
esac

# ------------------------------------------------------------------
printf '\n== IS A MISSING PATH REALLY A 404\n\n'
# THE CONTROL, AND WITHOUT IT EVERY 404 BELOW IS WORTHLESS. A Worker
# with single page app fallback answers 200 and the index for anything
# it does not recognise, which would make all nineteen leak checks pass
# while every one of those files was being served.
CTRL=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/no-such-path-9f3a2c7b1e")
if [ "$CTRL" = "404" ]; then
  ok "an unknown path returns 404, so the leak checks below mean something"
else
  bad "an unknown path returns $CTRL, NOT 404. The Worker is falling back."
  printf '        Every 404 check below is void until this is fixed.\n'
fi

# ------------------------------------------------------------------
printf '\n== THE EIGHT PAGES, DIRECT, NO REDIRECT FOLLOWED\n\n'
for p in $PATHS; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$p")
  if [ "$code" = "200" ]; then
    ok "200 direct, no redirect   $p"
  else
    dest=$(curl -sSL -o /dev/null -w '%{num_redirects} hops to %{url_effective} (%{http_code})' "$BASE$p")
    bad "$code at $p   ->  $dest"
  fi
done

# ------------------------------------------------------------------
printf '\n== THE ASSETS THE SITE NEEDS\n\n'
for p in /cabinet.js /cabinet.css /sitemap.xml /robots.txt /og-card.png \
         /apple-touch-icon-180.png \
         /music/track-1.m4a /music/track-2.m4a /music/track-3.m4a /music/track-4.m4a; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$p")
  [ "$code" = "200" ] && ok "200   $p" || bad "$code, expected 200   $p"
done

# ------------------------------------------------------------------
printf '\n== .git IS NOT ON THE WEB\n\n'
# THE WORST OF THEM, and it is worst because it is not the current
# files, it is every commit ever made. A served .git/config and
# .git/objects is the whole history, recoverable by anybody who thinks
# to look.
for p in /.git/HEAD /.git/config /.git/index /.git/COMMIT_EDITMSG \
         /.git/refs/heads/main /.git/logs/HEAD /.git/packed-refs; do
  code=$(curl -sSL -o /dev/null -w '%{http_code}' "$BASE$p")
  [ "$code" = "404" ] && ok "404   $p" || bad "$code, NOT 404   $p"
done

# ------------------------------------------------------------------
printf '\n== NO MARKDOWN IS SERVED\n\n'
# Generated from what is actually in the repository, so a document added
# later is checked without anybody remembering to add it here.
MD=$(ls "$HERE" | grep '\.md$')
if [ -z "$MD" ]; then
  printf '  (no markdown at the root to check)\n'
else
  for f in $MD; do
    code=$(curl -sSL -o /dev/null -w '%{http_code}' "$BASE/$f")
    [ "$code" = "404" ] && ok "404   /$f" || bad "$code, NOT 404   /$f"
  done
fi
# And the two folders full of it.
for p in /_content/ /_content/1-car-games.md /_reference/ /_reference/snaphit-index.html; do
  code=$(curl -sSL -o /dev/null -w '%{http_code}' "$BASE$p")
  [ "$code" = "404" ] && ok "404   $p" || bad "$code, NOT 404   $p"
done

# ------------------------------------------------------------------
printf '\n== NO DOTFILE IS SERVED\n\n'
for p in /.assetsignore /.gitignore /.env /.DS_Store /.wrangler/ /.jekyll-cache/; do
  code=$(curl -sSL -o /dev/null -w '%{http_code}' "$BASE$p")
  [ "$code" = "404" ] && ok "404   $p" || bad "$code, NOT 404   $p"
done

# ------------------------------------------------------------------
printf '\n== THE REST OF WHAT MUST NOT BE PUBLISHED\n\n'
for p in /brand/ /brand/make-og-card.js /build-pages.js /publish-check.sh \
         /wrangler.jsonc /_config.yml /CNAME /package.json /node_modules/; do
  code=$(curl -sSL -o /dev/null -w '%{http_code}' "$BASE$p")
  [ "$code" = "404" ] && ok "404   $p" || bad "$code, NOT 404   $p"
done

# ------------------------------------------------------------------
printf '\n== THE SITEMAP AND ROBOTS\n\n'
sm=$(curl -sS "$BASE/sitemap.xml" | tr '<' '\n' | grep '^loc>' | sed 's/^loc>//')
n=$(printf '%s\n' "$sm" | grep -c 'http')
[ "$n" = "8" ] && ok "the sitemap lists exactly 8 URLs" \
                || bad "the sitemap lists $n URLs, expected 8"
for u in $sm; do
  case "$u" in
    "$CANON"/*) ;;
    *) bad "sitemap entry is on the wrong host: $u"; continue ;;
  esac
  case "$u" in */) ;; *) bad "sitemap entry has no trailing slash: $u"; continue ;; esac
  want=$(printf '%s\n' "$PATHS" | grep -c "^${u#$CANON}\$")
  [ "$want" = "1" ] && ok "in the sitemap and in the eight   ${u#$CANON}" \
                    || bad "sitemap lists a URL that is not one of the eight: $u"
done
for p in $PATHS; do
  printf '%s\n' "$sm" | grep -q "^$CANON$p\$" \
    || bad "one of the eight is missing from the sitemap: $p"
done

# ------------------------------------------------------------------
printf '\n== EVERY CANONICAL AGAINST THE URL IT SITS ON\n\n'
for p in $PATHS; do
  got=$(curl -sSL "$BASE$p" | tr '>' '\n' | grep -i 'rel="canonical"' \
        | sed -E 's/.*href="([^"]*)".*/\1/' | head -1)
  want="$CANON$p"
  if [ -z "$got" ]; then bad "no canonical at all on   $p"
  elif [ "$got" = "$want" ]; then ok "canonical matches   $got"
  else
    bad "canonical mismatch on $p"
    printf '        it says  %s\n        want     %s\n' "$got" "$want"
  fi
done

# ------------------------------------------------------------------
printf '\n== THE SHARE CARD RESOLVES\n\n'
img=$(curl -sS "$BASE/" | tr '>' '\n' | grep -i 'property="og:image"' \
      | sed -E 's/.*content="([^"]*)".*/\1/' | head -1)
printf '  og:image on the game root is  %s\n' "$img"
case "$img" in
  "$CANON"/*) ok "og:image is absolute and on the canonical host" ;;
  *) bad "og:image is not on the canonical host: $img" ;;
esac
hdr=$(curl -sS -o /dev/null -w '%{http_code} %{content_type} %{size_download}' \
      "$BASE${img#$CANON}")
case "$hdr" in
  200\ image/*) ok "og:image resolves: $hdr" ;;
  *) bad "og:image does not resolve: $hdr" ;;
esac

# ------------------------------------------------------------------
printf '\n'
if [ "$fail" = "0" ]; then
  printf '  ALL CLEAR, %s checks against %s\n\n' "$pass" "$BASE"
  exit 0
fi
printf '  %s FAILED, %s passed, against %s\n\n' "$fail" "$pass" "$BASE"
exit 1
