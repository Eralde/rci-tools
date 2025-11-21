import {RrdTick} from '../_shared.ts';

export interface ShowInterfaceRrdResponse {
  data: Array<RrdTick<string>>;
}
