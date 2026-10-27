import * as _ from 'lodash-es';
import type {BaseTrait} from '../../traits';
import {type NdmNetworkRole} from '../../rci';

export class IpvcRolesField {
  constructor(
    public entity: BaseTrait,
  ) {
  }

  public readConfig(): NdmNetworkRole[] {
    return _
      .chain(this.entity)
      .get('dto.sc.ipvc.role', '')
      .split(',')
      .map((item) => item as NdmNetworkRole)
      .filter()
      .value();
  }

  public hasAnyRole(): boolean {
    return this.readConfig().length > 0;
  }

  public hasRole(ndmRole: NdmNetworkRole): boolean {
    return this.readConfig().includes(ndmRole);
  }
}
