import {describe, expect, it, vi} from 'vitest';
import {firstValueFrom, of} from 'rxjs';
import {RciManager} from '../../../src';
import {makeTransport} from '../test.utils';

const VERSION_DATA = {release: '4.3.1', title: 'test-device'};

function makeVersionTransport() {
  const transport = makeTransport();

  transport.sendQueryArray = vi.fn().mockReturnValue(of([{show: {version: VERSION_DATA}}]));

  return transport;
}

describe('RciManager.execute extractData handling', () => {
  it('unwraps the response at the query path by default', async () => {
    const manager = new RciManager('http://device', makeVersionTransport());

    const result = await firstValueFrom(manager.execute({path: 'show.version'}));

    expect(result).toEqual(VERSION_DATA);
  });

  it('returns the raw envelope when extractData is false', async () => {
    const manager = new RciManager('http://device', makeVersionTransport());

    const result = await firstValueFrom(manager.execute({path: 'show.version', extractData: false}));

    expect(result).toEqual({show: {version: VERSION_DATA}});
  });

  it('yields undefined for a query path missing from the response', async () => {
    const transport = makeTransport();

    transport.sendQueryArray = vi.fn().mockReturnValue(of([{show: {version: VERSION_DATA}}, {}]));

    const manager = new RciManager('http://device', transport);

    const result = await firstValueFrom(manager.execute([
      {path: 'show.version'},
      {path: 'show.identification'},
    ]));

    expect(result).toEqual([VERSION_DATA, undefined]);
  });
});

describe('RciManager readonly query arrays', () => {
  it('accepts readonly query arrays', async () => {
    const queries = Object.freeze([{path: 'show.version'}, {path: 'show.identification'}] as const);
    const executeTransport = makeTransport();
    const queueTransport = makeTransport();

    executeTransport.sendQueryArray = vi.fn().mockReturnValue(of([{show: {version: VERSION_DATA}}, {}]));
    queueTransport.sendQueryArray = vi.fn().mockReturnValue(of([{show: {version: VERSION_DATA}}, {}]));

    const executed = await firstValueFrom(new RciManager('http://device', executeTransport).execute(queries));
    const queued = await firstValueFrom(new RciManager('http://device', queueTransport).queue(queries));

    expect(executed).toEqual([VERSION_DATA, undefined]);
    expect(queued).toEqual([VERSION_DATA, undefined]);
  });
});
