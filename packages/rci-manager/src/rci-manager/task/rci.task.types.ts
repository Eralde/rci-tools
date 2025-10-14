import {Subject} from 'rxjs';
import {RciQuery} from '../query/';
import type {ObjectOrArray} from '../../type.utils';

export interface Task {
  isSingleQuery: boolean;
  queries: RciQuery[];
  subject: Subject<ObjectOrArray>;
}

interface PartialQueryMapItem {
  key: string;
  query: RciQuery;
  indices: number[];
}

export interface QueryMapItem extends PartialQueryMapItem {
  keyIndex: number;
}

export interface PartialQueryMap {
  [key: string]: PartialQueryMapItem;
}

export interface QueryMap {
  [key: string]: QueryMapItem;
}
