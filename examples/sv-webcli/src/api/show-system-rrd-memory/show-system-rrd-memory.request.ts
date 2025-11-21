import {DETAIL_LEVEL} from '../_shared.ts';

export interface ShowSystemRrdMemoryRequest {
  detail: DETAIL_LEVEL;
  attribute: 'used';
  count?: number;
}
