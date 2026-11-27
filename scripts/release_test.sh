#!/usr/bin/env bash
# Checks release.sh's guards in a throwaway clone (default under ~/.nht, never /tmp):
#   scripts/release_test.sh
# Every case must be refused before anything is built or pushed. The clone's origin points
# nowhere, so a guard that fails to refuse cannot publish anything.
set -uo pipefail

src="$(cd "$(dirname "$0")/.." && pwd)"
work="${RELEASE_TEST_DIR:-$HOME/.nht}/release-test-clone"
rm -rf "$work"
git clone -q "$src" "$work"
trap 'rm -rf "$work"' EXIT
cd "$work"
git checkout -q --detach "$(git -C "$src" rev-parse HEAD)"
git remote set-url origin /nonexistent/nowhere.git
git config user.name test
git config user.email test@example.com

fail=0
# expect_refused NAME PATTERN ARGS...: release.sh must exit non-zero within 20s and say PATTERN
# on stderr, which proves a guard refused it rather than a later step failing.
expect_refused() {
  local name="$1" pattern="$2"
  shift 2
  local err
  err="$(timeout 20 scripts/release.sh "$@" 2>&1 >/dev/null)"
  local code=$?
  if [ "$code" -ne 0 ] && [ "$code" -ne 124 ] && grep -q -- "$pattern" <<<"$err"; then
    echo "ok   $name"
  else
    echo "FAIL $name (exit $code): $(tail -n 1 <<<"$err")"
    fail=1
  fi
  git reset -q --hard
  git clean -qfd -e node_modules
  git checkout -q --detach "$(git -C "$src" rev-parse HEAD)"
  git tag -d "v9.9.9" "v9.9.9-beta.1" >/dev/null 2>&1
}

expect_refused "no build tag, no --dry-run" "requires the tag build/v9.9.9" 9.9.9
expect_refused "misspelt flag --dryrun" "usage" 9.9.9 --dryrun
expect_refused "misspelt flag --dry_run" "usage" 9.9.9 --dry_run
expect_refused "extra argument after --dry-run" "usage" 9.9.9 --dry-run extra
expect_refused "beta, no build tag, no --dry-run" "requires the tag build/v9.9.9-beta.1" 9.9.9-beta.1
expect_refused "no version" "usage"
expect_refused "two-part version" "usage" 9.9 --dry-run
expect_refused "version with v" "usage" v9.9.9 --dry-run
expect_refused "rc, not beta" "usage" 9.9.9-rc.1 --dry-run
expect_refused "beta without a number" "usage" 9.9.9-beta --dry-run
expect_refused "beta number with a suffix" "usage" 9.9.9-beta.1x --dry-run

git -c tag.gpgSign=false tag build/v9.9.9 HEAD~1
expect_refused "HEAD not at build tag" "HEAD is not the commit of build/v9.9.9" 9.9.9
expect_refused "HEAD not at build tag, even with --dry-run" "HEAD is not the commit of build/v9.9.9" 9.9.9 --dry-run

git -c tag.gpgSign=false tag build/v9.9.9-beta.1 HEAD~1
expect_refused "beta, HEAD not at build tag" "HEAD is not the commit of build/v9.9.9-beta.1" 9.9.9-beta.1

exit $fail
