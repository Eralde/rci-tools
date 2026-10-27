import * as _ from 'lodash-es';
import {BaseTrait} from './base/base.trait';
import {ZERO_IP} from '../rci';

export class Ip46Trait extends BaseTrait {
  public isConnected(): boolean {
    const status = this.dto.show;

    return _.has(status, 'address')
      && status?.address !== ZERO_IP
      && status?.['connected'] === 'yes';
  }
}
