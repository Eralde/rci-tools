import {describe, expectTypeOf, it} from 'vitest';
import type {Observable} from 'rxjs';
import {
  type BaseHttpResponse,
  type GenericObject,
  type QueryData,
  type QueryStats,
  RciManager,
  type RciQuery,
  type RciResponseOf,
  type RciResultsOf,
  type TypedRciQuery,
} from '../../../src';
import {makeTransport} from '../test.utils';

describe('RciManager public types', () => {
  it('types execute() single query and query arrays separately', () => {
    const manager = new RciManager('http://device', makeTransport());

    expectTypeOf(manager.execute({path: 'show.version'}))
      .toEqualTypeOf<Observable<GenericObject | undefined>>();

    expectTypeOf(manager.execute([{path: 'show.version'}]))
      .toEqualTypeOf<Observable<[GenericObject | undefined]>>();
  });

  it('types queue() single query and query arrays separately', () => {
    const manager = new RciManager('http://device', makeTransport());

    expectTypeOf(manager.queue({path: 'show.version'}))
      .toEqualTypeOf<Observable<GenericObject | undefined>>();

    expectTypeOf(manager.queue([{path: 'show.version'}]))
      .toEqualTypeOf<Observable<[GenericObject | undefined]>>();
  });

  it('defaults BaseHttpResponse data to unknown', () => {
    expectTypeOf<BaseHttpResponse['data']>().toEqualTypeOf<unknown>();
  });

  it('accepts interface-typed data without an index signature', () => {
    interface MacAccessListRequest {
      index: number;
      mac: string;
    }

    expectTypeOf<MacAccessListRequest>().toMatchTypeOf<QueryData>();
    expectTypeOf<MacAccessListRequest[]>().toMatchTypeOf<QueryData>();
    expectTypeOf<MacAccessListRequest>().toMatchTypeOf<NonNullable<RciQuery['data']>>();
  });

  it('narrows stats$ to the manager QueryPath generic', () => {
    const manager = new RciManager<'show.version'>('http://device', makeTransport());

    expectTypeOf(manager.stats$).toEqualTypeOf<Observable<QueryStats<'show.version'>>>();
  });

  it('supports per-call response generics on queue()', () => {
    interface ShowVersionResponse {
      release: string;
      title: string;
    }

    const manager = new RciManager('http://device', makeTransport());

    expectTypeOf(manager.queue<ShowVersionResponse>({path: 'show.version'}))
      .toEqualTypeOf<Observable<ShowVersionResponse | undefined>>();

    expectTypeOf(manager.queue<ShowVersionResponse>([{path: 'show.version'}]))
      .toEqualTypeOf<Observable<Array<ShowVersionResponse | undefined>>>();
  });

  it('supports per-call response generics on execute()', () => {
    interface ShowVersionResponse {
      release: string;
      title: string;
    }

    const manager = new RciManager('http://device', makeTransport());

    expectTypeOf(manager.execute<ShowVersionResponse>({path: 'show.version'}))
      .toEqualTypeOf<Observable<ShowVersionResponse | undefined>>();

    expectTypeOf(manager.execute<ShowVersionResponse>([{path: 'show.version'}]))
      .toEqualTypeOf<Observable<Array<ShowVersionResponse | undefined>>>();
  });

  it('preserves explicit response generics that overlap RciQuery', () => {
    interface PathResponse {
      path: string;
    }

    const manager = new RciManager('http://device', makeTransport());
    const query: RciQuery = {path: 'show.version'};

    expectTypeOf(manager.queue<PathResponse>(query))
      .toEqualTypeOf<Observable<PathResponse | undefined>>();
    expectTypeOf(manager.execute<PathResponse>(query))
      .toEqualTypeOf<Observable<PathResponse | undefined>>();
    expectTypeOf(manager.queue<PathResponse[]>([query]))
      .toEqualTypeOf<Observable<Array<PathResponse[] | undefined>>>();
    expectTypeOf(manager.execute<PathResponse[]>([query]))
      .toEqualTypeOf<Observable<Array<PathResponse[] | undefined>>>();
    expectTypeOf(manager.queue<any>([query]))
      .toEqualTypeOf<Observable<Array<any | undefined>>>();
  });

  it('keeps the queue fallback parameter mutable', () => {
    expectTypeOf<Parameters<RciManager['queue']>[0]>()
      .toEqualTypeOf<RciQuery | RciQuery[]>();
  });
});

describe('RciManager typed queries', () => {
  interface ShowVersion {
    release: string;
    title: string;
  }

  interface ShowSystem {
    hostname: string;
  }

  interface RequiredResponse {
    data: number[];
    ts: string;
  }

  const manager = new RciManager('http://device', makeTransport());
  const version: TypedRciQuery<ShowVersion> = {path: 'show.version'};
  const system: TypedRciQuery<ShowSystem> = {path: 'show.system'};
  const plain: RciQuery = {path: 'show.clock.date'};

  type VersionAndSystem = [ShowVersion | undefined, ShowSystem | undefined];

  it('infers the response of a single typed query', () => {
    expectTypeOf(manager.queue(version)).toEqualTypeOf<Observable<ShowVersion | undefined>>();
    expectTypeOf(manager.execute(version)).toEqualTypeOf<Observable<ShowVersion | undefined>>();
    expectTypeOf(manager.queue(plain)).toEqualTypeOf<Observable<GenericObject | undefined>>();
  });

  it('infers a tuple for an array literal', () => {
    expectTypeOf(manager.queue([version, system])).toEqualTypeOf<Observable<VersionAndSystem>>();
    expectTypeOf(manager.execute([version, system])).toEqualTypeOf<Observable<VersionAndSystem>>();
    expectTypeOf(manager.queue([version, system], {saveConfiguration: true}))
      .toEqualTypeOf<Observable<VersionAndSystem>>();
    expectTypeOf(manager.queue([version, plain]))
      .toEqualTypeOf<Observable<[ShowVersion | undefined, GenericObject | undefined]>>();
    expectTypeOf(manager.queue([])).toEqualTypeOf<Observable<[]>>();
  });

  it('keeps arrays built at runtime as arrays', () => {
    const dynamic: RciQuery[] = [];
    const frozen: readonly RciQuery[] = [];

    expectTypeOf(manager.queue(dynamic)).toEqualTypeOf<Observable<Array<GenericObject | undefined>>>();
    expectTypeOf(manager.queue(frozen)).toEqualTypeOf<Observable<Array<GenericObject | undefined>>>();
    expectTypeOf(manager.execute(frozen)).toEqualTypeOf<Observable<Array<GenericObject | undefined>>>();
  });

  it('keeps an unannotated array variable as an array', () => {
    // without `as const`, a `const` holding an array literal is inferred as an array, not a tuple
    const queries = [{path: 'show.version'}, {path: 'show.system'}];

    expectTypeOf(manager.queue(queries)).toEqualTypeOf<Observable<Array<GenericObject | undefined>>>();
    const pair: readonly [RciQuery, RciQuery] = [{path: 'show.version'}, {path: 'show.system'}];

    expectTypeOf(manager.queue(pair))
      .toEqualTypeOf<Observable<[GenericObject | undefined, GenericObject | undefined]>>();
  });

  it('lets an explicit response type override the typed query', () => {
    expectTypeOf(manager.queue<RequiredResponse>(version)).toEqualTypeOf<Observable<RequiredResponse | undefined>>();
    expectTypeOf(manager.execute<RequiredResponse>([version, system]))
      .toEqualTypeOf<Observable<Array<RequiredResponse | undefined>>>();
  });

  it('keeps existing casts compiling', () => {
    expectTypeOf(manager.queue(plain) as Observable<RequiredResponse>)
      .toEqualTypeOf<Observable<RequiredResponse>>();
    expectTypeOf(manager.queue([plain, plain]) as Observable<[RequiredResponse, RequiredResponse]>)
      .toEqualTypeOf<Observable<[RequiredResponse, RequiredResponse]>>();
    expectTypeOf(manager.execute(plain) as Observable<RequiredResponse>)
      .toEqualTypeOf<Observable<RequiredResponse>>();
  });

  it('rejects a result length that does not match the queries', () => {
    expectTypeOf(manager.queue([plain, plain]))
      .toEqualTypeOf<Observable<[GenericObject | undefined, GenericObject | undefined]>>();
    // @ts-expect-error three results for two queries
    void (manager.queue([plain, plain]) as Observable<[RequiredResponse, RequiredResponse, RequiredResponse]>);
    // @ts-expect-error one result for two queries
    void (manager.queue([version, system]) satisfies Observable<[ShowVersion | undefined]>);
  });

  it('works with a narrowed QueryPath via an alias', () => {
    type Path = 'show.version' | 'show.system';
    type Query<T> = TypedRciQuery<T, Path>;

    const narrowed = new RciManager<Path>('http://device', makeTransport());
    const narrowedVersion: Query<ShowVersion> = {path: 'show.version'};

    expectTypeOf(narrowed.queue(narrowedVersion)).toEqualTypeOf<Observable<ShowVersion | undefined>>();
    // @ts-expect-error `path: string` is not a narrowed QueryPath
    void narrowed.queue(version);
    // @ts-expect-error unknown path
    void narrowed.queue([narrowedVersion, {path: 'show.nope'}]);
  });

  it('exposes the response helper types', () => {
    expectTypeOf<RciResponseOf<typeof version>>().toEqualTypeOf<ShowVersion>();
    expectTypeOf<RciResponseOf<typeof plain>>().toEqualTypeOf<GenericObject>();
    expectTypeOf<RciResultsOf<[typeof version, typeof plain]>>()
      .toEqualTypeOf<[ShowVersion | undefined, GenericObject | undefined]>();
  });
});
