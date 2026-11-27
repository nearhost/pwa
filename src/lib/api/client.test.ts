import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ApiError, NotSignedIn, createClient } from './client.js';
import { fakeFetch, json, problem, session, state } from './testing.js';
import type {
  BodyOf,
  GetPaths,
  ParamsOf,
  Response200,
  ResponseOf,
  State,
  WritePaths,
  components,
} from './types.js';

const recheck = 'POST /api/v1/projects/shop/recheck';
const answer = 'POST /api/v1/passthroughs/requests/a1/answer';

function setup() {
  const fake = fakeFetch();
  fake.on('GET /api/v1/session', () => json(session()));
  const client = createClient({ fetch: fake.fetch });
  return { fake, client };
}

describe('createClient', () => {
  it('reads the session and a state', async () => {
    const { fake, client } = setup();
    fake.on('GET /api/v1/state', () => json(state(7)));
    expect(await client.session()).toEqual(session());
    expect((await client.get('/v1/state')).seq).toBe(7);
  });

  it('sends the token and the JSON content type on a write without a body', async () => {
    const { fake, client } = setup();
    fake.on(recheck, () => new Response(null, { status: 204 }));
    const answered = await client.send('POST', '/v1/projects/{name}/recheck', undefined, {
      name: 'shop',
    });
    expect(answered).toBeUndefined();
    const call = fake.calls.find((c) => `${c.method} ${c.path}` === recheck)!;
    expect(call.headers.get('X-Nearhost-CSRF')).toBe('token-1');
    expect(call.headers.get('Content-Type')).toBe('application/json');
    expect(call.body).toBeUndefined();
  });

  it('sends the token and the JSON content type on a write with a body', async () => {
    const { fake, client } = setup();
    fake.on(answer, () => new Response(null, { status: 204 }));
    await client.send(
      'POST',
      '/v1/passthroughs/requests/{id}/answer',
      { answer: 'yes' },
      { id: 'a1' },
    );
    const call = fake.calls.find((c) => `${c.method} ${c.path}` === answer)!;
    expect(call.headers.get('X-Nearhost-CSRF')).toBe('token-1');
    expect(call.headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(call.body!)).toEqual({ answer: 'yes' });
  });

  it('reads the session once for many writes', async () => {
    const { fake, client } = setup();
    fake.on(recheck, () => new Response(null, { status: 204 }));
    await client.send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' });
    await client.send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' });
    expect(fake.count('GET /api/v1/session')).toBe(1);
  });

  it('escapes path parameters', async () => {
    const { fake, client } = setup();
    fake.on('POST /api/v1/projects/a%2Fb/recheck', () => new Response(null, { status: 204 }));
    await client.send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'a/b' });
    expect(fake.count('POST /api/v1/projects/a%2Fb/recheck')).toBe(1);
  });

  it('reads the token again after a refused write and retries once', async () => {
    const { fake, client } = setup();
    let tokens = 0;
    fake.on('GET /api/v1/session', () => json(session({ csrf: `token-${++tokens}` })));
    fake.on(recheck, (call) =>
      call.headers.get('X-Nearhost-CSRF') === 'token-2'
        ? new Response(null, { status: 204 })
        : problem(403, 'proxy.api-write-refused'),
    );
    await client.send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' });
    expect(fake.count(recheck)).toBe(2);
    expect(fake.count('GET /api/v1/session')).toBe(2);
  });

  it('does not loop when the write is refused again', async () => {
    const { fake, client } = setup();
    fake.on(recheck, () => problem(403, 'proxy.api-write-refused'));
    const error = await client
      .send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).problem.code).toBe('proxy.api-write-refused');
    expect(fake.count(recheck)).toBe(2);
    expect(fake.count('GET /api/v1/session')).toBe(2);
  });

  it('does not retry a 403 for another reason', async () => {
    const { fake, client } = setup();
    fake.on(recheck, () => problem(403, 'grants.refused'));
    await expect(
      client.send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fake.count(recheck)).toBe(1);
  });

  it('throws the problem the core answers with', async () => {
    const { fake, client } = setup();
    fake.on(recheck, () => problem(404, 'control.not-found', 'No project shop'));
    const error = (await client
      .send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' })
      .catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.problem.title).toBe('No project shop');
  });

  it('throws an ApiError with a problem of its own when the answer is not JSON', async () => {
    const { fake, client } = setup();
    fake.on('GET /api/v1/state', () => new Response('<!doctype html>', { status: 502 }));
    const error = (await client.get('/v1/state').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.problem.title).toBeTruthy();
  });

  it('throws NotSignedIn on a 401, and tells its observers', async () => {
    const { fake, client } = setup();
    const signedOut = vi.fn();
    client.observe({ signedOut });
    fake.on('GET /api/v1/state', () => problem(401, 'proxy.api-sign-in'));
    const error = await client.get('/v1/state').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotSignedIn);
    expect(error).toBeInstanceOf(ApiError);
    expect(signedOut).toHaveBeenCalledOnce();
  });

  it('tells its observers of every successful answer, and of no failed one', async () => {
    const { fake, client } = setup();
    const answered = vi.fn();
    const stop = client.observe({ answered });
    fake.on('GET /api/v1/state', () => json(state(1)));
    fake.on(recheck, () => problem(404, 'control.not-found'));
    await client.get('/v1/state');
    await client.get('/v1/state');
    expect(answered).toHaveBeenCalledTimes(2);
    await client
      .send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' })
      .catch(() => {});
    // The session read before the write answered; the write did not.
    expect(answered).toHaveBeenCalledTimes(3);
    stop();
    await client.get('/v1/state');
    expect(answered).toHaveBeenCalledTimes(3);
  });

  it('takes another base', async () => {
    const fake = fakeFetch();
    fake.on('GET /core/api/v1/state', () => json(state(3)));
    const client = createClient({ base: '/core/api', fetch: fake.fetch });
    expect((await client.get('/v1/state')).seq).toBe(3);
    expect(client.url('/v1/events?after=3')).toBe('/core/api/v1/events?after=3');
  });

  it('derives its types from the schema', () => {
    expectTypeOf<Response200<'/v1/state'>>().toEqualTypeOf<State>();
    expectTypeOf<'/v1/events'>().not.toExtend<GetPaths>();
    expectTypeOf<'/v1/state'>().not.toExtend<WritePaths>();
    expectTypeOf<ResponseOf<'/v1/projects/{name}/recheck', 'POST'>>().toEqualTypeOf<undefined>();
    expectTypeOf<ResponseOf<'/v1/pair', 'POST'>>().toEqualTypeOf<
      components['schemas']['PairInfo']
    >();
    expectTypeOf<BodyOf<'/v1/passthroughs/requests/{id}/answer', 'POST'>>().toEqualTypeOf<
      components['schemas']['AnswerRequest']
    >();
    expectTypeOf<ParamsOf<'/v1/projects/{name}/start'>>().toEqualTypeOf<{ name: string }>();
    expectTypeOf<ParamsOf<'/v1/stop'>>().toEqualTypeOf<undefined>();
    expect(true).toBe(true);
  });

  it('passes a signal to a read, and rejects when it aborts', async () => {
    const { fake, client } = setup();
    fake.on('GET /api/v1/state', () => new Promise<Response>(() => {}));
    const controller = new AbortController();
    const read = client.get('/v1/state', { signal: controller.signal });
    controller.abort(new DOMException('gave up', 'TimeoutError'));
    await expect(read).rejects.toThrow('gave up');
  });
});
