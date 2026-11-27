// Whether the app runs installed (display-mode: standalone) or in a browser tab. app.css keys the
// keep-clear band and bottom inset on the data-display-mode attribute this sets on <html>.
//
// Reading the mode through matchMedia, rather than in a CSS media query, is also the test hook:
// Playwright cannot emulate display-mode, so tests/shell.spec.ts makes this query match with an
// init script. Nothing a URL can reach changes the layout.

const query = '(display-mode: standalone)';

// Safari on iOS before display-mode support reported a home-screen app here.
function legacyStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function watchDisplayMode(): () => void {
  const list = matchMedia(query);
  const apply = () => {
    const standalone = list.matches || legacyStandalone();
    document.documentElement.setAttribute(
      'data-display-mode',
      standalone ? 'standalone' : 'browser',
    );
  };
  apply();
  list.addEventListener('change', apply);
  return () => list.removeEventListener('change', apply);
}
