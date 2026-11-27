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
  tidy
}
# expect_done NAME PATTERN ARGS...: release.sh must exit 0 within 20s, so before any build, and
# say PATTERN on stdout: the release is already made and there is nothing left to do.
expect_done() {
  local name="$1" pattern="$2"
  shift 2
  local out
  out="$(timeout 20 scripts/release.sh "$@" 2>&1)"
  local code=$?
  if [ "$code" -eq 0 ] && grep -q -- "$pattern" <<<"$out"; then
    echo "ok   $name"
  else
    echo "FAIL $name (exit $code): $(tail -n 1 <<<"$out")"
    fail=1
  fi
  tidy
}
tidy() {
  git reset -q --hard
  git clean -qfd -e node_modules
  git checkout -q --detach "$(git -C "$src" rev-parse HEAD)"
  # Module tags a case made, or that a guard failing to refuse let release.sh make.
  git tag -l 'v9.9.*' | xargs -r git tag -d >/dev/null
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

# Releases come only from commits on main, and betas only from release-please's branch. The
# clone's origin/* refs are faked: HEAD is on neither branch until a case moves one onto it.
head="$(git rev-parse HEAD)"
rp=release-please--branches--main--components--build
git update-ref refs/remotes/origin/main HEAD~1
git update-ref "refs/remotes/origin/$rp" HEAD~1
git -c tag.gpgSign=false tag build/v9.9.8 HEAD
git -c tag.gpgSign=false tag build/v9.9.8-beta.1 HEAD
expect_refused "release not on main" "build/v9.9.8 is not on origin/main" 9.9.8
expect_refused "beta not on the release PR's branch" "build/v9.9.8-beta.1 is not on origin/$rp" 9.9.8-beta.1
git update-ref refs/remotes/origin/main "$head"
expect_refused "beta on main but not the release PR's branch" "build/v9.9.8-beta.1 is not on origin/$rp" 9.9.8-beta.1
git update-ref refs/remotes/origin/main HEAD~1
git update-ref "refs/remotes/origin/$rp" "$head"
expect_refused "release on the release PR's branch but not main" "build/v9.9.8 is not on origin/main" 9.9.8
git update-ref -d refs/remotes/origin/main
expect_refused "release, no origin/main at all" "build/v9.9.8 is not on origin/main" 9.9.8

# A rerun after release.sh pushed the module tag finds that tag on the release commit it made
# (parent: the build tag's commit) and stops there, so the workflow can go on to the notes.
# Any other commit under that tag is refused.
release_commit="$(git commit-tree "HEAD^{tree}" -p HEAD -m "release v9.9.8")"
git -c tag.gpgSign=false tag v9.9.8 "$release_commit"
git update-ref refs/remotes/origin/main "$head"
expect_done "rerun after the module tag was pushed" "v9.9.8 is already released" 9.9.8
git -c tag.gpgSign=false tag v9.9.8-beta.1 HEAD~1
expect_refused "module tag on another commit" "tag v9.9.8-beta.1 already exists" 9.9.8-beta.1

exit $fail
