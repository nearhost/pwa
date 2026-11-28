//go:build release

package pwa

import (
	"io/fs"
	"regexp"
	"testing"
)

func TestReleaseCarriesTheBuild(t *testing.T) {
	if !Built() {
		t.Fatal("Built() is false in a release")
	}
	// service-worker.js keeps the shell for offline use; the core serves it from the page host.
	for _, name := range []string{"index.html", "manifest.webmanifest", "service-worker.js"} {
		if _, err := fs.Stat(FS(), name); err != nil {
			t.Errorf("FS() lacks %s: %v", name, err)
		}
	}
	files, err := fs.Glob(FS(), "_app/immutable/*/*")
	if err != nil || len(files) == 0 {
		t.Errorf("FS() has no files under _app/immutable/ (%v)", err)
	}
}

// A release is X.Y.Z and a beta X.Y.Z-beta.N, as scripts/release.sh accepts.
var releaseVersion = regexp.MustCompile(`^\d+\.\d+\.\d+(-beta\.\d+)?$`)

func TestReleaseVersion(t *testing.T) {
	if !releaseVersion.MatchString(Version) {
		t.Fatalf("Version = %q, want X.Y.Z or X.Y.Z-beta.N", Version)
	}
}

func TestReleaseVersionPattern(t *testing.T) {
	for v, want := range map[string]bool{
		"0.1.0": true, "12.34.56": true, "0.1.0-beta.1": true, "0.1.0-beta.12": true,
		"dev": false, "0.1": false, "v0.1.0": false, "0.1.0-rc.1": false, "0.1.0-beta": false,
		"0.1.0-beta.1x": false, "0.1.0-beta.1-beta.2": false,
	} {
		if got := releaseVersion.MatchString(v); got != want {
			t.Errorf("releaseVersion matches %q = %v, want %v", v, got, want)
		}
	}
}
