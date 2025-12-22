import {RciQuery} from '../query/';
import type {GenericObject} from '../../type.utils';

export enum QUERY_SORT {
  NONE = 0b00,
  SHOW_FIRST = 0b01,
  SAVE_CONFIGURATION_LAST = 0b10,
}

export interface CompactPayload {
  queryMap: QueryMap;
  queryArray: GenericObject[];
}

export interface PartialQueryMapItem {
  key: string;
  query: RciQuery;
  indices: number[];
}

export interface QueryMapItem extends PartialQueryMapItem {
  keyIndex: number;
}

export type PartialQueryMap = Record<string, PartialQueryMapItem>;

export interface QueryMap {
  [key: string]: QueryMapItem;
}
