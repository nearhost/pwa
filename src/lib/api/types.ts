// The one place the app takes the API's types from. Everything else imports from here, so a change
// of where they come from (a new @nearhost/api, or types generated another way) touches this file
// alone.
import type { components, paths } from '@nearhost/api';

export type { components, paths };

type Schemas = components['schemas'];

export type Session = Schemas['Session'];
export type State = Schemas['State'];
export type Envelope = Schemas['Envelope'];
export type Problem = Schemas['Problem'];

/** The methods that change something; the gate treats any method but GET and HEAD as a write. */
export type WriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type Operation<P extends keyof paths, M extends string> = M extends keyof paths[P]
  ? Exclude<paths[P][M], undefined>
  : never;

type JSONOf<R> = R extends { content: { 'application/json': infer B } } ? B : never;

/** The paths with a GET whose answer is JSON (the event stream is read with openEvents). */
export type GetPaths = {
  [P in keyof paths]: [JSONOf<Operation<P, 'get'>['responses'][200]>] extends [never] ? never : P;
}[keyof paths];

/** The JSON a GET of P answers with. */
export type Response200<P extends GetPaths> = JSONOf<Operation<P, 'get'>['responses'][200]>;

/** The write methods P takes. */
export type MethodsOf<P extends keyof paths> = {
  [M in WriteMethod]: [Operation<P, Lowercase<M>>] extends [never] ? never : M;
}[WriteMethod];

/** The paths that take at least one write. */
export type WritePaths = {
  [P in keyof paths]: [MethodsOf<P>] extends [never] ? never : P;
}[keyof paths];

/** The JSON body a write of P with M takes, or undefined when it takes none. */
export type BodyOf<P extends WritePaths, M extends MethodsOf<P>> =
  Operation<P, Lowercase<M>> extends { requestBody: { content: { 'application/json': infer B } } }
    ? B
    : undefined;

type ResponsesOf<O> = O extends { responses: infer R } ? R : never;

type Success<R> = R extends { 200: infer S } | { 201: infer S } ? JSONOf<S> : never;

type WriteResult<P extends WritePaths, M extends MethodsOf<P>> = Success<
  ResponsesOf<Operation<P, Lowercase<M>>>
>;

/** What a write of P with M answers with: its JSON, or undefined for an empty answer. */
export type ResponseOf<P extends WritePaths, M extends MethodsOf<P> = MethodsOf<P>> = [
  WriteResult<P, M>,
] extends [never]
  ? undefined
  : WriteResult<P, M>;

type ParamNames<P extends string> = P extends `${string}{${infer N}}${infer Rest}`
  ? N | ParamNames<Rest>
  : never;

/** The values of P's path parameters, such as { name: 'shop' } for /v1/projects/{name}/start. */
export type ParamsOf<P extends string> = [ParamNames<P>] extends [never]
  ? undefined
  : Record<ParamNames<P>, string>;

/** How a read of P is made: a templated path must be given its parameters. */
export type GetOptions<P extends string> = [ParamNames<P>] extends [never]
  ? { signal?: AbortSignal }
  : { params: ParamsOf<P>; signal?: AbortSignal };

/** The arguments after the path of a read of P: its options, required when P is templated. */
export type GetArgs<P extends string> = [ParamNames<P>] extends [never]
  ? [init?: GetOptions<P>]
  : [init: GetOptions<P>];

/**
 * The arguments after the path of a write of P with M: the body, and the path parameters when P is
 * templated, which are then required (pass undefined for the body of a write that takes none).
 */
export type SendArgs<P extends WritePaths, M extends MethodsOf<P>> = [ParamNames<P>] extends [never]
  ? [body?: BodyOf<P, M>]
  : [body: BodyOf<P, M>, params: ParamsOf<P>];
