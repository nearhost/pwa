// The app's colour scheme as it is now, followed as it changes: the appearance setting (data-theme
// on <html>) or, under System, the device's.
import { schemeOf, type Scheme } from './model.js';

/** The app's scheme now. */
export function currentScheme(): Scheme {
  return schemeOf(
    document.documentElement.getAttribute('data-theme'),
    matchMedia('(prefers-color-scheme: dark)').matches,
  );
}

/** Calls set with the scheme now and each time it changes, until the returned function is called. */
export function followScheme(set: (scheme: Scheme) => void): () => void {
  const root = document.documentElement;
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const update = () => set(schemeOf(root.getAttribute('data-theme'), dark.matches));
  update();
  dark.addEventListener('change', update);
  const observer = new MutationObserver(update);
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    dark.removeEventListener('change', update);
    observer.disconnect();
  };
}
