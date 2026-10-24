import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Subject, of} from 'rxjs';
import {type BaseHttpResponse, RciManager} from '../../../src';
import {makeTransport, respondToQueryArray} from '../test.utils';

const RCI = 'http://device/rci/';

describe('RciManager.queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a priority task before an earlier batch task', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);

    manager.queue({path: 'show.version'}).subscribe();
    manager.queue({path: 'show.system'}, {isPriorityTask: true}).subscribe();

    vi.advanceTimersByTime(0);

    expect(transport.post).toHaveBeenCalledTimes(2);
    expect(transport.post).toHaveBeenNthCalledWith(1, RCI, [{show: {system: {}}}]);
    expect(transport.post).toHaveBeenNthCalledWith(2, RCI, [{show: {version: {}}}]);
  });

  it('batches non-priority tasks within batchTimeout', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport, {batchTimeout: 50});

    manager.queue({path: 'show.version'}).subscribe();
    manager.queue({path: 'show.system'}).subscribe();

    vi.advanceTimersByTime(49);
    expect(transport.post).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(transport.post).toHaveBeenCalledTimes(1);
    expect(transport.post).toHaveBeenCalledWith(RCI, [{show: {version: {}}}, {show: {system: {}}}]);
  });

  it('re-sends a preempted batch task after the priority task', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    const subjects: Subject<BaseHttpResponse>[] = [];
    const priorityResults: unknown[] = [];
    const batchResults: unknown[] = [];

    vi.mocked(transport.post).mockImplementation(() => {
      const response$ = new Subject<BaseHttpResponse>();
      subjects.push(response$);

      return response$;
    });

    manager.queue({path: 'show.version'}).subscribe(result => batchResults.push(result));
    vi.advanceTimersByTime(20);
    expect(transport.post).toHaveBeenCalledTimes(1);
    expect(transport.post).toHaveBeenNthCalledWith(1, RCI, [{show: {version: {}}}]);

    manager.queue({path: 'show.system'}, {isPriorityTask: true}).subscribe(result => priorityResults.push(result));
    vi.advanceTimersByTime(0);

    expect(transport.post).toHaveBeenCalledTimes(2);
    expect(transport.post).toHaveBeenNthCalledWith(2, RCI, [{show: {system: {}}}]);
    expect(subjects[0]!.observed).toBe(false);

    subjects[1]!.next({status: 200, data: [{show: {system: {name: 'sys'}}}]});
    subjects[1]!.complete();

    expect(transport.post).toHaveBeenCalledTimes(3);
    expect(transport.post).toHaveBeenNthCalledWith(3, RCI, [{show: {version: {}}}]);

    subjects[2]!.next({status: 200, data: [{show: {version: {release: '1'}}}]});
    subjects[2]!.complete();

    expect(priorityResults).toEqual([{name: 'sys'}]);
    expect(batchResults).toEqual([{release: '1'}]);
  });

  it('sends the save query last and drops its result', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    const results: unknown[] = [];

    respondToQueryArray(transport, queries => of(queries));
    manager
      .queue(
        [
          {path: 'system.description', data: 'Home'},
          {path: 'system.name', data: 'router'},
        ],
        {saveConfiguration: true},
      )
      .subscribe(result => results.push(result));

    vi.advanceTimersByTime(20);

    expect(transport.post).toHaveBeenCalledWith(RCI, [
      {system: {description: 'Home'}},
      {system: {name: 'router'}},
      {system: {configuration: {save: {}}}},
    ]);
    expect(results).toEqual([['Home', 'router']]);
  });

  it('does not add a save query without saveConfiguration', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);

    manager
      .queue([
        {path: 'system.description', data: 'Home'},
        {path: 'system.name', data: 'router'},
      ])
      .subscribe();

    vi.advanceTimersByTime(20);

    expect(transport.post).toHaveBeenCalledWith(RCI, [
      {system: {description: 'Home'}},
      {system: {name: 'router'}},
    ]);
  });

  it('maps results back to tasks when the payload is reordered', () => {
    const transport = makeTransport();
    const manager = new RciManager('http://device', transport);
    const descriptionResults: unknown[] = [];
    const versionResults: unknown[] = [];

    respondToQueryArray(transport, queries =>
      of(queries.map(query => ('show' in query ? {show: {version: {release: '1'}}} : query))),
    );

    manager
      .queue({path: 'system.description', data: 'Home'}, {saveConfiguration: true})
      .subscribe(result => descriptionResults.push(result));
    manager.queue({path: 'show.version'}).subscribe(result => versionResults.push(result));

    vi.advanceTimersByTime(20);

    expect(transport.post).toHaveBeenCalledWith(RCI, [
      {show: {version: {}}},
      {system: {description: 'Home'}},
      {system: {configuration: {save: {}}}},
    ]);
    expect(descriptionResults).toEqual(['Home']);
    expect(versionResults).toEqual([{release: '1'}]);
  });
});
