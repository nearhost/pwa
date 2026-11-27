#!/usr/bin/env bash
# Build the app and commit it as a Go module release: scripts/release.sh X.Y.Z [--dry-run]
# Run from a checkout of the build/vX.Y.Z tag. Makes a "release vX.Y.Z" commit on a detached HEAD that
# carries dist/ and version.go (on no branch), tags it vX.Y.Z and pushes only that tag (not with --dry-run).
set -euo pipefail

version="${1:-}"
dry_run=false
[ "${2:-}" = "--dry-run" ] && dry_run=true
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: scripts/release.sh X.Y.Z [--dry-run]" >&2
  exit 2
fi

cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "the working tree is not clean" >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/build/v$version" >/dev/null &&
  [ "$(git rev-parse HEAD)" != "$(git rev-parse "refs/tags/build/v$version^{commit}")" ]; then
  echo "HEAD is not the commit of build/v$version" >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
  echo "tag v$version already exists" >&2
  exit 1
fi

npm ci
npm run build

cat >version.go <<EOF
package pwa

// Version is the release this commit was built as. Set by scripts/release.sh.
const Version = "$version"
EOF

go test -p 4 -tags release .

# An ordinary commit: the pre-commit hook runs but leaves dist/ alone (dist/ is in .prettierignore
# and eslint's ignores, so lint-staged leaves it alone), so the committed build is the built one.
git switch --detach --quiet
git add -f dist version.go
before="$(git write-tree)"
git -c user.name="${GIT_AUTHOR_NAME:-nearhost-ci}" -c user.email="${GIT_AUTHOR_EMAIL:-ci@nearhost.dev}" \
  commit --quiet -m "release v$version"
after="$(git rev-parse HEAD^{tree})"
if [ "$before" != "$after" ]; then
  echo "the commit hooks changed dist/" >&2
  exit 1
fi
git -c tag.gpgSign=false tag "v$version"
commit="$(git rev-parse HEAD)"

if $dry_run; then
  echo "dry run: would push tag v$version at commit $commit"
else
  git push origin "refs/tags/v$version"
  echo "pushed tag v$version at commit $commit"
fi
