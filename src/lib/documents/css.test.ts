// static/documents.css is the stylesheet the core inlines into a document asked for with
// ?theme=paper or ?theme=app. These check the rules the core's policies and HTML documents need.
import { readFileSync } from 'node:fs';
import postcss, { type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../../static/documents.css', import.meta.url), 'utf8');
const root = postcss.parse(css);

const rules: Rule[] = [];
root.walkRules((rule) => {
  rules.push(rule);
});
// As written, with the line breaks Prettier puts in a long selector taken out.
const selectors = rules.flatMap((rule) =>
  rule.selectors.map((s) => s.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')')),
);

/** Every declaration of prop in rules whose selector mentions what. */
function declared(prop: string, where: (selector: string) => boolean = () => true): string[] {
  const out: string[] = [];
  for (const rule of rules) {
    if (!rule.selectors.some(where)) continue;
    rule.walkDecls(prop, (d) => {
      out.push(d.value);
    });
  }
  return out;
}

describe('documents.css', () => {
  it('puts every selector wholly inside one :where(), so it weighs nothing', () => {
    expect(rules.length).toBeGreaterThan(20);
    for (const selector of selectors) {
      expect(selector).toMatch(/^:where\(:root\[data-nh-theme(=|\])/);
      // The :where( that opens the selector closes at its very end.
      let depth = 0;
      let closed = -1;
      for (let i = 0; i < selector.length && closed < 0; i++) {
        if (selector[i] === '(') depth++;
        if (selector[i] === ')' && --depth === 0) closed = i;
      }
      expect(closed, selector).toBe(selector.length - 1);
      // A pseudo-element can't go inside :where(), and outside it would add weight.
      expect(selector).not.toContain('::');
    }
  });

  it('loads no font and nothing but data: images', () => {
    expect(css).not.toMatch(/@font-face|@import/);
    for (const url of css.match(/url\([^)]*\)/g) ?? []) expect(url).toMatch(/^url\(["']?data:/);
    for (const family of declared('font-family')) {
      expect(family).not.toMatch(/Space Grotesk|DM Sans|IBM Plex/);
    }
  });

  it('styles everything a Markdown page has', () => {
    const wanted = [
      '.home',
      'article',
      'h1',
      'h2',
      'h3',
      'p',
      'ul',
      'ol',
      'li',
      'table',
      'th',
      'td',
      'code',
      'pre',
      'blockquote',
      'img',
      'hr',
      "input[type='checkbox']",
    ];
    for (const w of wanted) {
      expect(
        selectors.some((s) => s.includes(w)),
        `a rule for ${w}`,
      ).toBe(true);
    }
  });

  it('colours the syntax classes the core’s highlighter writes', () => {
    const classes = ['k', 'kd', 'nf', 'nb', 's', 's1', 's2', 'm', 'mi', 'c', 'c1', 'cm', 'o', 'p'];
    for (const c of classes) {
      expect(
        selectors.some((s) => s.includes('.chroma ') && new RegExp(`\\.${c}(?![\\w-])`).test(s)),
        `.chroma .${c}`,
      ).toBe(true);
    }
  });

  it('marks a highlighter error as the core does, with a background', () => {
    const err = rules.find((r) => r.selector.includes('.chroma .err'));
    const props: string[] = [];
    err?.walkDecls((d) => {
      props.push(d.prop);
    });
    expect(props).toEqual(expect.arrayContaining(['background', 'color']));
  });

  it('outlines images, darker on paper and light, lighter on dark', () => {
    expect(css).toContain('oklch(0 0 0 / 0.1)');
    expect(css).toContain('oklch(1 0 0 / 0.1)');
  });

  it('sets the colour scheme from data-nh-scheme, or the system’s without it', () => {
    expect(declared('color-scheme', (s) => s.includes("[data-nh-scheme='dark']"))).toEqual([
      'dark',
    ]);
    expect(declared('color-scheme', (s) => s.includes("[data-nh-scheme='light']"))).toEqual([
      'light',
    ]);
    let media = false;
    root.walkAtRules('media', (at) => {
      if (/prefers-color-scheme/.test(at.params)) {
        at.walkRules((rule) => {
          if (rule.selector.includes(':not([data-nh-scheme])')) media = true;
        });
      }
    });
    expect(media).toBe(true);
    // Paper is a light page in either scheme.
    expect(declared('color-scheme', (s) => s === ":where(:root[data-nh-theme='paper'])")).toEqual([
      'light',
    ]);
  });
});
