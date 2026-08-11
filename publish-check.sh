#!/bin/sh
# THE SITE AS SERVED, NOT AS BUILT.
#
#   ./publish-check.sh
#
# Everything this checks has been verified against a local build already.
# None of that is worth anything: the questions here are about redirects,
# about what a host chooses to publish out of a repository, and about
# whether a file is where a tag says it is, and a host is the only thing
# that can answer those. Run it after a deploy and before submitting the
# sitemap.
#
# Two optional arguments, both for testing this script rather than the
# site. The first is where to fetch from, the second is what the
# canonical tags are expected to say. They differ only when pointing this
# at a local server, where the pages are served from 127.0.0.1 and still
# correctly claim driftfever.com:
#
#   ./publish-check.sh http://127.0.0.1:8794 https://driftfever.com
#
# curl and grep. Nothing else, so it runs anywhere.

BASE="${1:-https://driftfever.com}"
CANON="${2:-https://driftfever.com}"
BASE="${BASE%/}"
CANON="${CANON%/}"

pass=0
fail=0

ok()   { pass=$((pass+1)); printf '  ok    %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL  %s\n' "$1"; }

# The eight canonical paths, which are the sitemap and nothing else.
PATHS="/
/car-games-online/
/where-to-play-drift-hunters/
/browser-games-official-sites/
/drift-boss-one-button-games/
/racing-games-online/
/drift-games-online/
/driving-games-online/"

# What must not be on the web. The first six are what was asked for; the
# rest are the same leak wearing the names it was moved to, because a
# folder renamed back would reappear silently and this is the check that
# would catch it.
LEAKS="/BRIEF.md
/CLAUDE.md
/VISUAL.md
/content/
/content/1-car-games.md
/reference/
/reference/snaphit-index.html
/brand/
/brand/make-og-card.js
/_content/
/_content/1-car-games.md
/_reference/
/_reference/snaphit-index.html
/_config.yml
/build-pages.js
/publish-check.sh
/README.md
/SESSION-1-PROMPT.md
/drift-fever-retention-handoff.md"

# ------------------------------------------------------------------
printf '\n== THE EIGHT PAGES, DIRECT, NO REDIRECT FOLLOWED\n\n'
# NOT -L. Following a redirect would report 200 for a URL that is really
# a 301, and a canonical pointing at a redirect is the exact mistake the
# trailing slashes are there to avoid. Anything but a straight 200 is
# chased separately so the report says where it went.
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
printf '\n== WHAT MUST NOT BE PUBLISHED\n\n'
for p in $LEAKS; do
  code=$(curl -sSL -o /dev/null -w '%{http_code}' "$BASE$p")
  # -L HERE, deliberately, and it is the opposite choice to the one
  # above. A 301 to a served copy is a leak with a redirect in front of
  # it, so what matters is where it ENDS UP, not what it answers first.
  if [ "$code" = "404" ]; then
    ok "404   $p"
  else
    bad "$code, NOT 404   $p"
  fi
done

# ------------------------------------------------------------------
printf '\n== THE SITEMAP AND ROBOTS\n\n'
for p in /sitemap.xml /robots.txt; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$p")
  [ "$code" = "200" ] && ok "200   $p" || bad "$code, expected 200   $p"
done

sm=$(curl -sS "$BASE/sitemap.xml" | tr '<' '\n' | grep '^loc>' | sed 's/^loc>//')
n=$(printf '%s\n' "$sm" | grep -c 'http')
if [ "$n" = "8" ]; then
  ok "the sitemap lists exactly 8 URLs"
else
  bad "the sitemap lists $n URLs, expected 8"
fi

# Every entry names the canonical host and carries its trailing slash,
# and the set is exactly the eight above. A sitemap that lists a URL the
# pages do not claim is worse than one that omits it.
for u in $sm; do
  case "$u" in
    "$CANON"/*|"$CANON") ;;
    *) bad "sitemap entry is on the wrong host: $u"; continue ;;
  esac
  case "$u" in
    */) ;;
    *) bad "sitemap entry has no trailing slash: $u"; continue ;;
  esac
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
  # -L, so a page behind a redirect is still read rather than reported
  # as having no canonical at all. The redirect itself is section one's
  # to complain about and one fault should produce one failure.
  got=$(curl -sSL "$BASE$p" \
        | tr '>' '\n' \
        | grep -i 'rel="canonical"' \
        | sed -E 's/.*href="([^"]*)".*/\1/' \
        | head -1)
  want="$CANON$p"
  if [ -z "$got" ]; then
    bad "no canonical at all on   $p"
  elif [ "$got" = "$want" ]; then
    ok "canonical matches   $got"
  else
    bad "canonical mismatch on $p"
    printf '        it says  %s\n        want     %s\n' "$got" "$want"
  fi
done

# ------------------------------------------------------------------
printf '\n== THE SHARE CARD RESOLVES\n\n'
# Read out of the page rather than assumed, because the point of the
# check is that the tag and the file agree.
img=$(curl -sS "$BASE/" | tr '>' '\n' | grep -i 'property="og:image"' \
      | sed -E 's/.*content="([^"]*)".*/\1/' | head -1)
printf '  og:image on the game root is  %s\n' "$img"
case "$img" in
  "$CANON"/*) ok "og:image is absolute and on the canonical host" ;;
  *) bad "og:image is not on the canonical host: $img" ;;
esac
# Fetched from BASE rather than from the tag, so this still works when
# pointed at a local server.
imgpath="${img#$CANON}"
hdr=$(curl -sS -o /dev/null -w '%{http_code} %{content_type} %{size_download}' "$BASE$imgpath")
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
