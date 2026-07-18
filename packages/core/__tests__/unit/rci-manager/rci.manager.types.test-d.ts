import {describe, expectTypeOf, it} from 'vitest';
import type {Observable} from 'rxjs';
import {
  type BaseHttpResponse,
  type GenericObject,
  type QueryData,
  type QueryStats,
  RciManager,
  type RciQuery,
} from '../../../src';
import {makeTransport} from '../test.utils';

describe('RciManager public types', () => {
  it('types execute() single query and query arrays separately', () => {
    const manager = new RciManager('http://device', makeTransport());

    expectTypeOf(manager.execute({path: 'show.version'}))
      .toEqualTypeOf<Observable<GenericObject | undefined>>();

    expectTypeOf(manager.execute([{path: 'show.version'}]))
      .toEqualTypeOf<Observable<Array<GenericObject | undefined>>>();
  });

  it('types queue() single query and query arrays separately', () => {
    const manager = new RciManager('http://device', makeTransport());

    expectTypeOf(manager.queue({path: 'show.version'}))
      .toEqualTypeOf<Observable<GenericObject | undefined>>();

    expectTypeOf(manager.queue([{path: 'show.version'}]))
      .toEqualTypeOf<Observable<Array<GenericObject | undefined>>>();
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
});
