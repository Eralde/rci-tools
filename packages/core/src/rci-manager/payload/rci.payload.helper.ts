import {flatMap, get, mapValues, orderBy, pick, reduce, set, sortBy} from 'lodash-es';
import type {GenericObject} from '../../type.utils';
import type {RciQuery} from '../query/';
import {SAVE_CONFIGURATION_QUERY, Task} from '../queue/';
import {
  CompactPayload,
  PartialQueryMap,
  PartialQueryMapItem,
  QUERY_SORT,
  QueryMap,
  QueryMapItem,
} from './rci.payload.types';

export class RciPayloadHelper {
  public static compactQueries(queries: RciQuery[], sortMask: number = QUERY_SORT.NONE): CompactPayload {
    const partialQueryMap = reduce(
      queries,
      (acc, query, index) => {
        const keyObject = pick(query, ['path', 'data']);
        const key = JSON.stringify(keyObject);

        if (acc[key]) {
          acc[key].indices.push(index);
        } else {
          acc[key] = {
            key,
            query,
            indices: [index],
          };
        }

        return acc;
      },
      {} as PartialQueryMap,
    );

    const iteratees: Array<(item: PartialQueryMapItem) => boolean> = [];
    const orders: Array<'asc' | 'desc'> = [];

    let sortedByKey: PartialQueryMapItem[];

    if (sortMask & QUERY_SORT.SAVE_CONFIGURATION_LAST) {
      iteratees.push((item) => item.query.path.startsWith(SAVE_CONFIGURATION_QUERY));
      orders.push('asc');
    }

    if (sortMask & QUERY_SORT.SHOW_FIRST) {
      iteratees.push((item) => item.query.path.startsWith('show'));
      orders.push('desc');
    }

    if (iteratees.length > 0) {
      sortedByKey = orderBy(partialQueryMap, iteratees, orders);
    } else {
      sortedByKey = Object.values(partialQueryMap);
    }

    const queryArray = sortedByKey.map(({query}) => RciPayloadHelper.toQueryObject(query));
    const keyIndexes: Record<string, number> = sortedByKey.reduce(
      (acc, {key}, index) => ({...acc, [key]: index}),
      {},
    );

    const queryMap: QueryMap = mapValues(partialQueryMap, (item: Omit<QueryMapItem, 'keyIndex'>) => {
      return {
        ...item,
        keyIndex: keyIndexes[item.key]!,
      };
    });

    return {
      queryArray,
      queryMap,
    };
  }

  public static inflateResponse(responseArray: GenericObject[], queryMap: QueryMap): Array<GenericObject | undefined> {
    const chunks = flatMap(
      queryMap,
      ({keyIndex, indices}) => {
        const response = responseArray[keyIndex];

        // Index in the 'indices' array is the index in the array
        // resulting from the merge of queries from all tasks
        return indices.map((idx) => ({idx, response}));
      },
    );

    return sortBy(chunks, 'idx')
      .map((item) => item.response);
  }

  public static batchTasks(tasks: Task[]): CompactPayload {
    const allQueries: RciQuery[] = flatMap(tasks, 'queries');

    return RciPayloadHelper.compactQueries(allQueries, QUERY_SORT.SHOW_FIRST & QUERY_SORT.SAVE_CONFIGURATION_LAST);
  }

  public static splitResponsesPerTask(
    batchedResponse: GenericObject[],
    tasks: Task[],
    queryMap: QueryMap,
  ): GenericObject[][] {
    const allResults = RciPayloadHelper.inflateResponse(batchedResponse, queryMap);

    const data: {startIdx: number; chunks: GenericObject[][]} = tasks.reduce(
      (acc, {queries}) => {
        const {startIdx, chunks} = acc;
        const endIdx = startIdx + queries.length;

        const chunk = allResults
          .slice(startIdx, endIdx)
          .map((response, index) => {
            return this.prepareResponseData(response!, queries[index]!);
          });

        return {
          startIdx: endIdx,
          chunks: [...chunks, chunk],
        };
      },
      {
        startIdx: 0,
        chunks: [] as GenericObject[][],
      },
    );

    return data.chunks;
  }

  protected static toQueryObject(query: RciQuery): GenericObject {
    const {path, data = {}} = query;

    return set({}, path, data);
  }

  protected static prepareResponseData(response: GenericObject, query: RciQuery): GenericObject {
    if (!query.extractData) {
      return response;
    }

    // We can't know the type of the value inside the `response` object
    return get(response, query.path) as GenericObject;
  }
}
