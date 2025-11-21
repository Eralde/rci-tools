import {DETAIL_LEVEL} from '../_shared.ts';

export enum RRD_ATTRIBUTE {
  RXSPEED = 'rxspeed',
  TXSPEED = 'txspeed',
}

export interface ShowInterfaceRrdRequest {
  name: string;
  detail: DETAIL_LEVEL;
  attribute: RRD_ATTRIBUTE.RXSPEED | RRD_ATTRIBUTE.TXSPEED;
}
