// The canvas's projects as the fake core's state: on this machine (leto) storefront with three
// routes, docs-site and a stopped admin; on the server build-box, api running and worker starting.
// The session is networked, so each route opens at its network address.
import type { Page, Route } from '@playwright/test';
import type { State } from '../src/lib/api/types.js';

type Project = NonNullable<State['projects']>[string];

export function project(state: Project['State'], extra: Partial<Project> = {}): Project {
  return {
    State: state,
    Message: '',
    Alias: '',
    WebLocalPort: 0,
    WebLocalPorts: null,
    Notice: '',
    Waiting: '',
    ...extra,
  };
}

const route = (host: string, port: number) => ({
  host: `${host}.test`,
  port,
  url: `https://${host}.test`,
  networkUrl: `https://${host}.lab.example.dev`,
});

export const canvas: Partial<State> = {
  projects: {
    storefront: project('running'),
    'docs-site': project('running'),
    admin: project('stopped'),
    api: project('running'),
    worker: project('starting', { Message: 'waiting for port 9000 to answer' }),
  },
  sites: {
    storefront: {
      routes: [
        route('storefront', 80),
        route('mail.storefront', 8025),
        route('vite.storefront', 5173),
      ],
    },
    'docs-site': { routes: [route('docs-site', 4321)] },
    admin: { routes: [route('admin', 8080)] },
    api: { server: 'build-box', routes: [route('api.build', 3000)] },
    worker: { server: 'build-box', routes: [route('worker.build', 9000)] },
  },
  servers: {
    'build-box': {
      health: {} as never,
      status: 'connected',
      message: '',
    },
  },
};

/**
 * Answers the projects' own addresses with a small page, except the hosts in hang, which never
 * answer, as a site that won't load in the frame doesn't.
 */
export async function serveSites(page: Page, opts: { hang?: string[] } = {}) {
  await page.route(/^https:\/\/[^/]*\.lab\.example\.dev\//, (r: Route) => {
    const host = new URL(r.request().url()).host;
    if (opts.hang?.includes(host)) return; // never answered
    return r.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><title>${host}</title><h1>${host}</h1>`,
    });
  });
}

type Approval = NonNullable<State['approvals']>[number];
type Change = NonNullable<Project['Pending']>;

// Ten minutes from when the tests start: well inside every request's wait.
const expires = new Date(Date.now() + 10 * 60_000).toISOString();

/** Requests that wait for the user, as the core's state lists them. */
export const requests = {
  /** An agent's proposal to add billing on this machine, serving port 8000. */
  proposal: (id: string, extra: Partial<NonNullable<Approval['proposal']>> = {}): Approval => ({
    id,
    proposal: {
      ID: id,
      Origin: 'local',
      Path: '/home/ecs/Code/billing',
      Name: 'billing',
      Web: 8000,
      Expires: expires,
      ...extra,
    },
  }),
  /** Claude Code on build-box asking to open its port 5173, for vite. */
  pass: (id: string, extra: Partial<NonNullable<Approval['pass']>> = {}): Approval => ({
    id,
    pass: {
      ID: id,
      Origin: 'build-box',
      Requester: 'claude-code',
      Session: '',
      Label: 'vite',
      Remote: 5173,
      LocalTaken: false,
      CanAlways: true,
      Expires: expires,
      ...extra,
    },
  }),
  /** Codex on this machine asking to show plans/checkout.md. */
  doc: (id: string, extra: Partial<NonNullable<Approval['doc']>> = {}): Approval => ({
    id,
    doc: {
      ID: id,
      Origin: 'local',
      Requester: 'codex',
      Session: '',
      Label: 'the plan',
      Root: '/home/ecs/Code/shop/docs',
      Doc: 'plans/checkout.md',
      CanAlways: true,
      NewRoot: false,
      Expires: expires,
      ...extra,
    },
  }),
  /** storefront's .nearhostrc asking to serve shop.com and to bind localhost:3306. */
  change: {
    SHA256: 'abc123',
    Project: {
      Name: 'storefront',
      Server: '',
      Path: '/home/ecs/Code/storefront',
      Alias: 'storefront.test',
      Enabled: true,
      Routes: [
        { Port: 80, Role: 'web', Label: '', Hosts: ['shop.com'] },
        { Port: 3306, Role: 'loopback', Label: 'mysql', Hosts: null },
      ],
    },
    Items: [
      { Port: 80, Host: 'shop.com', Why: 'a real domain', Option: '' },
      { Port: 3306, Host: '', Why: 'binds localhost on this machine', Option: 'loopback' },
    ],
  } satisfies Change as Change,
};

type Tree = NonNullable<State['documents']>[number];

/**
 * Served documents as the core's state lists them, newest first: Codex's HTML rate-limits spec on
 * build-box, then Claude Code's checkout plan and ideas on this machine.
 */
export const trees: Tree[] = [
  {
    ID: 'T2',
    Server: 'build-box',
    Root: '/home/ecs/src/api',
    Requester: 'codex',
    RootHandle: '',
    Docs: [{ Path: 'docs/rate-limits.html', Opened: '2026-11-27T11:20:00Z' }],
    Opened: '2026-11-27T11:20:00Z',
    Hidden: false,
  },
  {
    ID: 'T1',
    Server: 'local',
    Root: '/Users/ecs/Code/storefront',
    Requester: 'claude-code',
    RootHandle: '/Users/ecs/Code/storefront',
    Docs: [
      { Path: 'docs/plans/checkout.md', Opened: '2026-11-27T10:51:00Z' },
      { Path: 'docs/ideas.md', Opened: '2026-11-26T16:02:00Z' },
    ],
    Opened: '2026-11-26T16:02:00Z',
    Hidden: false,
  },
];

/** The body the core's Markdown renderer gives the checkout plan (goldmark with chroma classes). */
export const checkoutPlan = `<h1 id="checkout-redesign">Checkout redesign</h1>
<p>Move the shipping step ahead of payment, so the total a customer sees on the payment page is the total they pay. Today a <a href="https://storefront.lab.example.dev/cart">cart</a> over £50 shows free delivery until the address is in.</p>
<h2 id="steps">Steps</h2>
<ol>
<li>Split <code>CheckoutController@store</code> into address and payment actions.</li>
<li>Price delivery from the address, not the cart total.</li>
<li>Keep the old route for a week behind a flag.</li>
</ol>
<blockquote>
<p>Ask before changing the order email: support quotes it in replies.</p>
</blockquote>
<pre tabindex="0" class="chroma"><code class="language-php" data-lang="php"><span class="line"><span class="cl"><span class="c1">// The two new routes
</span></span></span><span class="line"><span class="cl"><span class="nx">Route</span><span class="o">::</span><span class="na">post</span><span class="p">(</span><span class="s1">'/checkout/address'</span><span class="p">,</span> <span class="p">[</span><span class="nx">CheckoutController</span><span class="o">::</span><span class="na">class</span><span class="p">,</span> <span class="s1">'address'</span><span class="p">]);</span>
</span></span><span class="line"><span class="cl"><span class="k">function</span> <span class="nf">total</span><span class="p">(</span><span class="kt">int</span> <span class="nv">$pence</span><span class="p">)</span><span class="o">:</span> <span class="kt">string</span> <span class="p">{</span> <span class="k">return</span> <span class="nb">number_format</span><span class="p">(</span><span class="nv">$pence</span> <span class="o">/</span> <span class="mi">100</span><span class="p">,</span> <span class="mi">2</span><span class="p">);</span> <span class="p">}</span>
</span></span></code></pre>
<h2 id="delivery-prices">Delivery prices</h2>
<table>
<thead>
<tr><th>Zone</th><th>Under £50</th><th>£50 and over</th></tr>
</thead>
<tbody>
<tr><td>UK mainland</td><td>£4.50</td><td>Free</td></tr>
<tr><td>Highlands and islands</td><td>£9.00</td><td>£4.50</td></tr>
<tr><td>Europe</td><td>£14.00</td><td>£9.00</td></tr>
</tbody>
</table>
<h3 id="the-new-page">The new page</h3>
<p><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='200'%3E%3Crect width='480' height='200' fill='%23ffffff'/%3E%3Crect x='24' y='24' width='200' height='16' rx='4' fill='%23dde0d9'/%3E%3Crect x='24' y='56' width='432' height='120' rx='8' fill='%23f4f5f1'/%3E%3C/svg%3E" alt="A sketch of the address step"></p>
<h2 id="checks">Checks</h2>
<ul>
<li><input checked="" disabled="" type="checkbox"> Feature tests for both actions</li>
<li><input disabled="" type="checkbox"> Try it on a phone through Nearhost</li>
</ul>
<hr>
<p>Inline <code>code</code>, <em>emphasis</em>, <strong>strong</strong> and a <a href="docs/ideas.md">link to the ideas</a>.</p>
`;

/**
 * An HTML document whose script, if it ever ran, would say so: it changes the app's title and its
 * own, marks its body and posts to the app.
 */
export const scriptedDocument = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Rate limiting spec</title></head>
<body>
<h1>Rate limiting for the API</h1>
<p>Each API key gets a bucket of 120 requests a minute.</p>
<p><a href="/d/T1/docs/ideas.md">The ideas</a> and <a href="https://example.com/" target="_blank">elsewhere</a>.</p>
<script>
  document.body.setAttribute('data-script-ran', '');
  document.title = 'script ran';
  try { parent.postMessage('script ran', '*'); } catch (e) {}
  try { parent.document.title = 'script ran'; } catch (e) {}
</script>
</body>
</html>
`;
