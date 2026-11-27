//go:build !release

package pwa

import (
	"os"
	"testing"
)

func TestFSIsNotNil(t *testing.T) {
	if FS() == nil {
		t.Fatal("FS() is nil")
	}
}

// On main the module carries only dist/.gitkeep. A local build leaves dist/index.html
// on disk, so the "not built" expectation only applies when it is absent.
func TestBuiltFollowsIndexHTML(t *testing.T) {
	_, err := os.Stat("dist/index.html")
	onDisk := err == nil
	if Built() != onDisk {
		t.Fatalf("Built() = %v, but dist/index.html on disk = %v", Built(), onDisk)
	}
}

func TestVersionIsDevOnMain(t *testing.T) {
	if Version != "dev" {
		t.Fatalf("Version = %q, want dev", Version)
	}
}
