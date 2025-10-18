import {GenericObject} from '../../type.utils';

/**
 * Usage example:
 *
 * const queries: RciQuery[] = [
 *   {path: 'show'},
 *   {path: 'show.interface'},
 *   {path: 'show.sc.interface', data: {name: 'Bridge0'}},
 * ];
 */
export interface RciQuery {
  path: string;
  data?: GenericObject; // defaults to {}
  extractDataByPath?: boolean; // defaults to true
}

export type RciTask = RciQuery | RciQuery[];
