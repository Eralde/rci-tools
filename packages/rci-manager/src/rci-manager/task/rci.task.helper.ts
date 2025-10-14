import _ from 'lodash';
import type {GenericObject} from '../../type.utils';
import type {RciQuery} from '../query/';
import {SAVE_CONFIGURATION_QUERY} from '../queue/rci.queue.constants';
import type {PartialQueryMap, QueryMap, QueryMapItem, Task} from './rci.task.types';

export class RciTaskHelper {
  public static mergeTaskQueries(tasks: Task[]): {queryMap: QueryMap; queryArray: GenericObject[]} {
    const allQueries: RciQuery[] = _.flatMap(tasks, 'queries');

    const partialQueryMap: PartialQueryMap = _.reduce(
      allQueries,
      (acc, query, index) => {
        const keyObject = _.pick(query, ['path', 'data']);
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

    // Custom sort:
    //
    // 1. We place queries that start with 'show' at the start of the batch.
    //    If a query that changes configuration precedes one that reads it, an error may occur.
    //
    // 2. Ensure that 'system configuration save' query is always last
    const sortedByKey = _.orderBy(
      partialQueryMap,
      [
        (item) => item.query.path.startsWith(SAVE_CONFIGURATION_QUERY),
        (item) => item.query.path.startsWith('show'),
      ],
      [
        'asc',
        'asc',
      ],
    );
    const queryArray = sortedByKey.map(({query}) => RciTaskHelper.toQueryObject(query));
    const keyIndexes: Record<string, number> = sortedByKey.reduce(
      (acc, {key}, index) => ({...acc, [key]: index}),
      {},
    );

    const queryMap: QueryMap = _.mapValues(partialQueryMap, (item: Omit<QueryMapItem, 'keyIndex'>) => {
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

  public static splitResponses(
    batchedResponse: GenericObject[],
    tasks: Task[],
    queryMap: QueryMap,
  ): GenericObject[][] {
    const allResults = _
      .chain(queryMap)
      .flatMap(({keyIndex, indices}) => {
        const response = batchedResponse[keyIndex];

        // Index in the 'indices' array is the index in the array
        // resulting from the merge of queries from all tasks
        return indices.map((idx) => ({idx, response}));
      })
      .sortBy('idx')
      .map('response')
      .value();

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

  public static toQueryObject(query: RciQuery): GenericObject {
    const {path, data = {}} = query;

    return _.set({}, path, data);
  }

  public static prepareResponseData(response: GenericObject, query: RciQuery): GenericObject {
    if (!query.extractDataByPath) {
      return response;
    }

    // We can't know the type of the value inside the `response` object
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return _.get(response, query.path) as GenericObject;
  }
}
