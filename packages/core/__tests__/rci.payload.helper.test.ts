import {describe, expect, it} from 'vitest';
import {last, uniqBy} from 'lodash-es';
import {RciPayloadHelper} from '../src/rci-manager/payload/rci.payload.helper';
import type {RciQuery} from '../src/rci-manager/query/';
import type {CompactPayload, QueryMap} from '../src/rci-manager/payload/rci.payload.types';
import {QUERY_SORT} from '../src/rci-manager/payload/rci.payload.types';
import {expectObjectContainingPath} from './test.utils';

describe('RciPayloadHelper', () => {
  const SHOW_VERSION = 'show.version';
  const SHOW_IDENTIFICATION = 'show.identification';
  const SYSTEM_CONFIGURATION_SAVE = 'system.configuration.save';
  const SYSTEM_DESCRIPTION = 'system.description';
  const INTERFACE = 'interface';

  const getUniqueQueries = (queries: RciQuery[]): RciQuery[] => {
    return uniqBy(queries, query => JSON.stringify(query));
  };

  describe('compactQueries', () => {
    const queries: RciQuery[] = [
      {path: SHOW_VERSION},
      {path: SHOW_IDENTIFICATION},
      {path: SHOW_VERSION}, // duplicate
      {path: SYSTEM_CONFIGURATION_SAVE},
      {path: SYSTEM_DESCRIPTION, data: 'foobar'},
      {path: INTERFACE, data: {name: 'Bridge0', 'description': 'Main Bridge!'}},
      {path: SYSTEM_DESCRIPTION, data: 'foobar'}, // duplicate
    ];

    it('should compact duplicate queries and preserve order (no sort, mask=0)', () => {
      const {queryArray, queryMap}: CompactPayload = RciPayloadHelper.compactQueries(queries, QUERY_SORT.NONE);

      // should deduplicate queries
      expect(queryArray.length).toBe(getUniqueQueries(queries).length);

      // should preserve the correct mapping for duplicates
      const versionKey = JSON.stringify({path: SHOW_VERSION});

      expect(queryMap[versionKey].indices).toEqual([0, 2]);
      expect(queryMap[versionKey].keyIndex).toBeDefined();

      // should preserve original order (first occurrence of each unique query)
      expect(queryArray[0]).toEqual(expectObjectContainingPath(SHOW_VERSION));
      expect(queryArray[1]).toEqual(expectObjectContainingPath(SHOW_IDENTIFICATION));
      expect(queryArray[2]).toEqual(expectObjectContainingPath(SYSTEM_CONFIGURATION_SAVE));
      expect(queryArray[3]).toEqual(expectObjectContainingPath(SYSTEM_DESCRIPTION));
      expect(queryArray[4]).toEqual(expectObjectContainingPath(INTERFACE));
    });

    it(`should sort "show" queries first (sortMask=${QUERY_SORT.SHOW_FIRST})`, () => {
      const {queryArray} = RciPayloadHelper.compactQueries(queries, QUERY_SORT.SHOW_FIRST);

      // "show" queries should be at the start (in the same order as in input)
      expect(queryArray[0]).toEqual(expectObjectContainingPath(SHOW_VERSION));
      expect(queryArray[1]).toEqual(expectObjectContainingPath(SHOW_IDENTIFICATION));

      // the rest are not "show"
      expect(queryArray.slice(2).every(q => !('show' in q))).toBe(true);
    });

    it(`should move "system configuration save" to end (sortMask=${QUERY_SORT.SAVE_CONFIGURATION_LAST})`, () => {
      const {queryArray} = RciPayloadHelper.compactQueries(queries, QUERY_SORT.SAVE_CONFIGURATION_LAST);
      // "system.configuration.save" should be last
      expect(last(queryArray)).toEqual(expectObjectContainingPath(SYSTEM_CONFIGURATION_SAVE));
    });

    it(`should sort "show" queries first and move "system configuration save" to end (sortMask=${QUERY_SORT.SHOW_FIRST | QUERY_SORT.SAVE_CONFIGURATION_LAST})`, () => {
      const {queryArray} = RciPayloadHelper.compactQueries(
        queries,
        QUERY_SORT.SHOW_FIRST | QUERY_SORT.SAVE_CONFIGURATION_LAST,
      );

      // "show" queries first, "system.configuration.save" last
      expect(queryArray[0]).toEqual(expectObjectContainingPath(SHOW_VERSION));
      expect(queryArray[1]).toEqual(expectObjectContainingPath(SHOW_IDENTIFICATION));
      expect(last(queryArray)).toEqual(expectObjectContainingPath(SYSTEM_CONFIGURATION_SAVE));

      // The rest (except last) are not "show"
      expect(
        queryArray.slice(2, -1).every(q => !('show' in q)),
      ).toBe(true);
    });

    it('should handle queries with data property and deduplicate', () => {
      const query1 = {path: SYSTEM_DESCRIPTION, data: 'foobar'};
      const query2 = {path: SYSTEM_DESCRIPTION, data: 'bazquux'};

      const queriesWithData: RciQuery[] = [
        query1,
        query2,
        query1,
      ];

      const {queryArray, queryMap}: CompactPayload = RciPayloadHelper.compactQueries(queriesWithData, QUERY_SORT.NONE);

      expect(queryArray.length).toBe(getUniqueQueries(queriesWithData).length);

      const key1 = JSON.stringify(query1);
      const key2 = JSON.stringify(query2);

      expect(queryMap[key1].indices).toEqual([0, 2]);
      expect(queryMap[key2].indices).toEqual([1]);
    });
  });

  describe('inflateResponse', () => {
    it('should map responses back to original query order', () => {
      // Simulate compacted queries and their responses
      const queries: RciQuery[] = [
        {path: SHOW_VERSION},
        {path: SHOW_IDENTIFICATION},
        {path: SHOW_VERSION}, // duplicate
      ];

      const {queryArray, queryMap}: CompactPayload = RciPayloadHelper.compactQueries(queries, QUERY_SORT.NONE);

      // Simulate responses for each unique query (order matches compacted unique queries)
      const responseArray = [
        {show: {version: '__SHOW_VERSION_DATA__'}},
        {show: {identification: '__SHOW_IDENTIFICATION_DATA__'}},
      ];

      // Map back to original order (should duplicate the first response)
      const inflated = RciPayloadHelper.inflateResponse(responseArray, queryMap);

      expect(inflated.length).toBe(3);
      expect(inflated[0]).toEqual({show: {version: '__SHOW_VERSION_DATA__'}});
      expect(inflated[1]).toEqual({show: {identification: '__SHOW_IDENTIFICATION_DATA__'}});
      expect(inflated[2]).toEqual({show: {version: '__SHOW_VERSION_DATA__'}});
    });
  });

  it('inflateResponse(compactQueries(list)) === list.map(RciPayloadHelper.toQueryObject) for any list and any sortMask', () => {
    const list: RciQuery[] = [
      {path: SHOW_VERSION},
      {path: SHOW_IDENTIFICATION},
      {path: SYSTEM_DESCRIPTION, data: 'foobar'},
      {path: INTERFACE, data: {name: 'Bridge0', 'description': 'Main Bridge!'}},
      {path: SYSTEM_CONFIGURATION_SAVE},
      {path: SHOW_VERSION}, // duplicate
      {path: SYSTEM_DESCRIPTION, data: 'foobar'}, // duplicate
    ];

    // Simulate a response for each unique query (the "response" is just the query itself for this test)
    const getResponseForQuery = (query: RciQuery) => query;

    const sortMaskValues = [
      QUERY_SORT.NONE,
      QUERY_SORT.SHOW_FIRST,
      QUERY_SORT.SAVE_CONFIGURATION_LAST,
      QUERY_SORT.SHOW_FIRST | QUERY_SORT.SAVE_CONFIGURATION_LAST,
    ];

    // Try all sortMask combinations
    for (const sortMask of sortMaskValues) {
      const {queryArray, queryMap} = RciPayloadHelper.compactQueries(list, sortMask);
      // The "response" for each unique query is just the query object itself
      const responseArray = queryArray.map(getResponseForQuery);

      // Inflate back to original order
      const inflated = RciPayloadHelper.inflateResponse(responseArray, queryMap);

      // should match the original list, but each item processed with toQueryObject
      const expected = list.map(q => RciPayloadHelper['toQueryObject'](q));
      expect(inflated).toEqual(expected);
    }
  });
});
