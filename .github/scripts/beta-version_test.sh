#!/bin/sh
# Checks beta-version.sh, which beta.yml numbers each beta with. CI's
# release-config job runs it; it needs only sh, so run it anywhere:
#
#   sh .github/scripts/beta-version_test.sh
set -u

dir=$(dirname "$0")
fail=0
# check VERSION "TAGS" WANT CODE: beta-version.sh VERSION, given the
# space-separated TAGS on standard input, must print WANT and exit CODE.
check() {
  code=0
  got=$(printf '%s' "$2" | tr ' ' '\n' | sh "$dir/beta-version.sh" "$1" 2>/dev/null) || code=$?
  if [ "$got" = "$3" ] && [ "$code" = "$4" ]; then
    echo "ok   $1 tags=[$2]: '$got' (exit $code)"
  else
    echo "::error::beta-version.sh $1 with tags [$2] gave '$got' (exit $code), want '$3' (exit $4)"
    fail=1
  fi
}

check 0.2.0 "build/v0.1.0 v0.1.0" 0.2.0-beta.1 0
check 0.2.0 "build/v0.1.0 build/v0.2.0-beta.1 build/v0.2.0-beta.2" 0.2.0-beta.3 0
check 0.2.0 "build/v0.2.0-beta.9 build/v0.2.0-beta.10" 0.2.0-beta.11 0
# Only build/v tags count: the module tags (v0.2.0-beta.N) follow from them,
# and other versions, other prerelease kinds and near misses don't count.
check 0.2.0 "v0.2.0-beta.5 build/v0.1.0-beta.7 build/v0.2.0-rc.1 build/v0.2.0-beta.1x xbuild/v0.2.0-beta.4 build/v0.2.0-beta.3/x" 0.2.0-beta.1 0
check 0.2.0 "build/v0.2.0-beta.2 build/v0.2.0" "" 2
check 0.1.0 "build/v0.1.0" "" 2
# The manifest's version before the first release: nothing to beta yet.
check 0.0.0 "" "" 2
check 0.2 "" "" 1
check v0.2.0 "" "" 1
check 0.2.0 "" 0.2.0-beta.1 0

exit $fail
