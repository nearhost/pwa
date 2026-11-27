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
	for _, name := range []string{"index.html", "manifest.webmanifest"} {
		if _, err := fs.Stat(FS(), name); err != nil {
			t.Errorf("FS() lacks %s: %v", name, err)
		}
	}
	files, err := fs.Glob(FS(), "_app/immutable/*/*")
	if err != nil || len(files) == 0 {
		t.Errorf("FS() has no files under _app/immutable/ (%v)", err)
	}
}

func TestReleaseVersion(t *testing.T) {
	if !regexp.MustCompile(`^\d+\.\d+\.\d+$`).MatchString(Version) {
		t.Fatalf("Version = %q, want X.Y.Z", Version)
	}
}
