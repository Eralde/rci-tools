import {DETAIL_LEVEL} from '../_shared.ts';

export interface ShowSystemRrdCpuRequest {
  detail: DETAIL_LEVEL;
  attribute: 'min' | 'avg' | 'max';
  count?: number;
}
