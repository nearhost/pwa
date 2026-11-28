import { expect, test, type Page } from '@playwright/test';
import { envelope, fakeApi, type FakeApi } from './fake-api.js';
import { canvas, project, requests } from './fixtures.js';
import { schemes, sizes } from './sizes.js';
import type { State } from '../src/lib/api/types.js';

// Each kind of request that waits, answered from the overview's list and from the link the core
// and agents hand out: the buttons are off until the core answers, the answer is sent once with
// the body the core takes, and the page says what was done.
const kinds = [
  {
    name: 'a proposal to add a project, declined',
    state: { approvals: [requests.proposal('a1')] },
    item: /An agent wants to add billing on leto/,
    path: '/approve/a1',
    heading: 'Add billing to Nearhost?',
    shows: [
      '/home/ecs/Code/billing',
      'port 8000',
      'Adding projects from the app comes next. To add it now, use Nearhost on leto, or decline it here.',
    ],
    route: 'POST /api/v1/proposals/a1/decline',
    button: 'Decline',
    body: { reason: '' },
    done: 'Declined. The agent was told no.',
  },
  {
    name: 'a passthrough request',
    state: { approvals: [requests.pass('a2')] },
    item: /Claude Code on build-box wants to open port 5173/,
    path: '/approve/a2',
    heading: 'Open port 5173?',
    shows: ['Claude Code on build-box wants to open port 5173 on leto (vite).'],
    route: 'POST /api/v1/passthroughs/requests/a2/answer',
    button: 'Open port 5173',
    body: { answer: 'yes' },
    done: 'Port 5173 is open on leto.',
  },
  {
    name: 'a passthrough request, always allowed',
    state: { approvals: [requests.pass('a2')] },
    item: /Claude Code on build-box wants to open port 5173/,
    path: '/approve/a2',
    heading: 'Open port 5173?',
    shows: ['Always allow lets Claude Code on build-box open more ports without asking.'],
    route: 'POST /api/v1/passthroughs/requests/a2/answer',
    button: 'Always allow Claude Code to open ports on build-box',
    body: { answer: 'always' },
    done: 'Port 5173 is open on leto. Claude Code on build-box can open more without asking.',
  },
  {
    name: 'a document request',
    state: { approvals: [requests.doc('a3')] },
    item: /Codex on leto wants to show checkout\.md/,
    path: '/approve/a3',
    heading: 'Show a document?',
    shows: ['plans/checkout.md', '/home/ecs/Code/shop/docs'],
    route: 'POST /api/v1/documents/requests/a3/answer',
    button: 'Decline',
    body: { answer: 'no' },
    done: 'Declined. Codex was told no.',
  },
  {
    name: "a project's change",
    state: {
      projects: {
        ...canvas.projects,
        storefront: project('running', { Pending: requests.change }),
      },
    },
    item: /storefront’s \.nearhostrc asks for 2 changes that need approval/,
    path: '/change/storefront',
    heading: 'Change to storefront',
    shows: ['shop.com on port 80', 'a real domain', 'shop.com → port 80'],
    route: 'POST /api/v1/projects/storefront/change/accept',
    button: 'Approve the change',
    body: { sha: 'abc123' },
    done: 'Approved what .nearhostrc asks for.',
  },
] as const;

type Kind = (typeof kinds)[number];

/** Answers kind's route only once released, so the test sees the buttons while it waits. */
function hold(api: FakeApi, route: string) {
  let release: (() => void) | undefined;
  api.on(route, () => new Promise((resolve) => (release = () => resolve({ status: 204 }))));
  return async () => {
    await expect.poll(() => release !== undefined).toBe(true);
    release!();
  };
}

async function answer(page: Page, api: FakeApi, kind: Kind) {
  const main = page.locator('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(kind.heading);
  for (const text of kind.shows) await expect(main).toContainText(text);
  const release = hold(api, kind.route);
  const buttons = main.locator('[data-answers] button');
  await main.getByRole('button', { name: kind.button }).click();
  // Every answer is off while one is on its way, and the page says it is sending.
  for (const b of await buttons.all()) await expect(b).toBeDisabled();
  await expect(main.getByText('Sending…')).toBeVisible();
  await release();
  await expect(main.getByRole('status')).toContainText(kind.done);
  // The focus moves to what came of it.
  await expect(main.getByRole('status')).toBeFocused();
  await expect(main.getByText('Sending…')).toHaveCount(0);
  // The core's proposal accept only tells the agent it was saved: the app never sends it.
  expect(api.requests.filter((r) => /\/proposals\/[^/]+\/accept$/.test(r.path))).toEqual([]);
  const sent = api.requests.filter((r) => `${r.method} ${r.path}` === kind.route);
  expect(sent).toHaveLength(1);
  expect(sent[0].body).toEqual(kind.body);
}

for (const size of sizes) {
  for (const scheme of schemes) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ viewport: size.viewport, colorScheme: scheme });

      for (const kind of kinds) {
        test(`${kind.name} is answered from the list`, async ({ page }) => {
          const api = await fakeApi(page, {
            state: { ...canvas, ...(kind.state as Partial<State>) },
          });
          await page.goto('/');
          const item = page.locator('#waiting').getByRole('link', { name: kind.item });
          await expect(item).toContainText('Review');
          await item.click();
          await expect(page).toHaveURL(kind.path);
          await answer(page, api, kind);
        });

        test(`${kind.name} is answered from its link`, async ({ page }) => {
          const api = await fakeApi(page, {
            state: { ...canvas, ...(kind.state as Partial<State>) },
          });
          await page.goto(kind.path);
          await answer(page, api, kind);
          // The core ending the request it took leaves what was done on the page.
          if (kind.path.startsWith('/approve/')) {
            api.state.approvals = [];
            await api.send(envelope(5, { kind: 'ended', id: kind.path.split('/').at(-1) }));
          }
          await expect(page.locator('main').getByRole('status')).toContainText(kind.done);
          await page.locator('main').getByRole('link', { name: 'Back to the overview' }).click();
          await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');
        });
      }

      test('a proposal is only declined here, with a reason, never accepted', async ({ page }) => {
        const api = await fakeApi(page, {
          state: {
            ...canvas,
            approvals: [requests.proposal('a1'), requests.proposal('a4', { Origin: 'mini' })],
          },
        });
        api.on('POST /api/v1/proposals/a1/decline', () => ({ status: 204 }));
        await page.goto('/approve/a1');
        const main = page.locator('main');
        await expect(main.locator('[data-answers] button')).toHaveText(['Decline']);
        await expect(main.getByRole('textbox', { name: 'Project name' })).toHaveCount(0);
        await main.getByRole('textbox', { name: /Reason/ }).fill('not now');
        await main.getByRole('button', { name: 'Decline' }).click();
        await expect(main.getByRole('status')).toContainText('Declined');

        // From a server removed from Nearhost while it waited: it says so, Decline only.
        await page.goto('/approve/a4');
        await expect(main).toContainText('mini, which is no longer in Nearhost');
        await expect(main).toContainText(
          'mini is no longer in Nearhost, so this project can’t be added.',
        );
        await expect(main.locator('[data-answers] button')).toHaveText(['Decline']);

        const posts = api.requests.filter((r) => r.method === 'POST');
        expect(posts.map((r) => [r.path, r.body])).toEqual([
          ['/api/v1/proposals/a1/decline', { reason: 'not now' }],
        ]);
      });

      test('a link to a request that is gone says it is no longer waiting', async ({ page }) => {
        await fakeApi(page, { state: canvas });
        await page.goto('/approve/nope');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText(
          'This request is no longer waiting',
        );
        await expect(main).toContainText('before this page opened');
        await page.goto('/change/storefront');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Change to storefront');
        await expect(main).toContainText('This request is no longer waiting');
        await main.getByRole('link', { name: 'Back to the overview' }).click();
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');
      });

      test('a request that ends while it is open says so in place', async ({ page }) => {
        const api = await fakeApi(page, {
          state: {
            ...canvas,
            approvals: [requests.pass('a2')],
            projects: {
              ...canvas.projects,
              storefront: project('running', { Pending: requests.change }),
            },
          },
        });
        await page.goto('/approve/a2');
        const main = page.locator('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Open port 5173?');
        api.state.approvals = [];
        await api.send(envelope(5, { kind: 'ended', id: 'a2' }));
        await expect(main.getByRole('heading', { level: 1 })).toHaveText(
          'This request is no longer waiting',
        );
        await expect(main).toContainText('It ended while this page was open');
        await expect(main.locator('[data-answers] button')).toHaveCount(0);

        await page.goto('/change/storefront');
        await expect(main.getByRole('button', { name: 'Approve the change' })).toBeVisible();
        api.state.projects!.storefront.Pending = null;
        await api.send(envelope(6, { kind: 'config' }));
        await expect(main).toContainText('This request is no longer waiting');
        await expect(main).toContainText('It ended while this page was open');
      });

      test("an answer that fails shows the problem's title, and can be tried again", async ({
        page,
      }) => {
        const api = await fakeApi(page, { state: { ...canvas, approvals: [requests.pass('a2')] } });
        api.on('POST /api/v1/passthroughs/requests/a2/answer', () => ({
          status: 500,
          body: { error: 'x', title: 'the grant store is locked', status: 500 },
        }));
        await page.goto('/approve/a2');
        const main = page.locator('main');
        await main.getByRole('button', { name: 'Open port 5173' }).click();
        await expect(main.getByRole('alert')).toHaveText('the grant store is locked');
        await expect(main.getByRole('alert')).toBeFocused();
        await expect(main.getByRole('button', { name: 'Open port 5173' })).toBeEnabled();
      });

      test('an answer to a request that had ended says already answered', async ({ page }) => {
        const api = await fakeApi(page, { state: { ...canvas, approvals: [requests.doc('a3')] } });
        api.on('POST /api/v1/documents/requests/a3/answer', () => ({
          status: 409,
          body: {
            error: 'the request for plans/checkout.md has ended: declined',
            title: 'the request for plans/checkout.md has ended: declined',
            status: 409,
            code: 'control.request-ended',
            ended: true,
          },
        }));
        await page.goto('/approve/a3');
        const main = page.locator('main');
        await main.getByRole('button', { name: 'Show the document' }).click();
        await expect(main.getByRole('heading', { level: 1 })).toHaveText(
          'This request is no longer waiting',
        );
        await expect(main).toContainText('Already answered');
        await expect(main.locator('[data-answers] button')).toHaveCount(0);
      });

      test('a Yes the core could not carry out ends the request and says why', async ({ page }) => {
        // As the core answers when the passthrough won't open: it ends the request, 409 ended.
        const api = await fakeApi(page, { state: { ...canvas, approvals: [requests.pass('a2')] } });
        api.on('POST /api/v1/passthroughs/requests/a2/answer', () => ({
          status: 409,
          body: {
            error: 'build-box isn’t connected',
            title: 'build-box isn’t connected',
            status: 409,
            code: 'control.request-ended',
            ended: true,
          },
        }));
        await page.goto('/approve/a2');
        const main = page.locator('main');
        await main.getByRole('button', { name: 'Open port 5173' }).click();
        await expect(main.getByRole('heading', { level: 1 })).toHaveText(
          'This request is no longer waiting',
        );
        await expect(main).toContainText('This request has ended: build-box isn’t connected');
        await expect(main).not.toContainText('Already answered');
        await expect(main.getByText(/This request has ended/)).toBeFocused();
      });

      test('while the machine cannot be reached, answers are off and say why', async ({ page }) => {
        const api = await fakeApi(page, { state: { ...canvas, approvals: [requests.pass('a2')] } });
        await page.goto('/approve/a2');
        const main = page.locator('main');
        await expect(main.getByRole('button', { name: 'Open port 5173' })).toBeEnabled();
        api.on('GET /api/v1/state', () => ({ status: 502, body: { title: 'Bad', status: 502 } }));
        await api.drop();
        for (const b of await main.locator('[data-answers] button').all()) {
          await expect(b).toBeDisabled();
        }
        await expect(main).toContainText(/Can't reach leto\..*answering waits until it's back\./);
      });

      test("an agent's long, right-to-left or HTML text stays text, inside its card", async ({
        page,
      }) => {
        const long = 'x'.repeat(300);
        const rtl = 'שרת הפיתוח של החנות';
        const html = '<img src=x onerror="window.__hacked=1">';
        await fakeApi(page, {
          state: {
            ...canvas,
            approvals: [
              requests.pass('a2', { Label: `${rtl} ${long}`, Requester: html }),
              requests.proposal('a1', { Name: long, Path: `/home/${rtl}/${long}` }),
            ],
          },
        });
        for (const path of ['/', '/approve/a2', '/approve/a1']) {
          await page.goto(path);
          await expect(page.locator('main')).toContainText(rtl);
          if (path !== '/approve/a1') await expect(page.locator('main')).toContainText(html);
          const overflow = await page.evaluate(() => {
            const width = document.documentElement.clientWidth;
            const out: string[] = [];
            if (document.documentElement.scrollWidth > width) out.push('page');
            for (const el of document.querySelectorAll('main *')) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && (r.right > width + 0.5 || r.left < -0.5)) {
                out.push(`${el.tagName}.${el.className}`);
              }
            }
            return out;
          });
          expect(overflow).toEqual([]);
          expect(await page.evaluate(() => (window as { __hacked?: number }).__hacked)).toBe(
            undefined,
          );
        }
      });
    });
  }
}
