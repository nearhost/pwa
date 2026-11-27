// Package pwa embeds the built Nearhost web app. The module's release commits carry dist/;
// on main only dist/.gitkeep is present and Built reports false.
package pwa

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var dist embed.FS

// FS returns the built app, rooted at the contents of dist.
func FS() fs.FS {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err) // unreachable: "dist" is a valid, embedded path
	}
	return sub
}

// Built reports whether the module carries a build (dist/index.html is present).
func Built() bool {
	info, err := fs.Stat(FS(), "index.html")
	return err == nil && !info.IsDir()
}
