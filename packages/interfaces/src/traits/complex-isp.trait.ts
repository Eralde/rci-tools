import {RolesTrait} from './base/roles.trait';
import {type IspTunnel, isPossibleIspTunnel} from '../entity/tunnel/tunnel.types';
import {NDM_NETWORK_ROLE} from '../rci';

export interface ComplexIspTrait extends RolesTrait {
  isIsp(): boolean;

  findIspTunnel(): IspTunnel | null;
}

export class ComplexIspTrait extends RolesTrait implements ComplexIspTrait {
  public isIsp(): boolean {
    return true;
  }

  public findIspTunnel(): IspTunnel | null {
    if (!this.isIsp()) {
      return null;
    }

    const tunnelCandidates: IspTunnel[] = this._collection.filter(isPossibleIspTunnel);
    const ispTunnels = tunnelCandidates
      .filter((tunnel) => {
        return tunnel.hasRole(NDM_NETWORK_ROLE.INET) || !tunnel.hasAnyRole();
      })
      .filter((tunnel) => tunnel.via.readConfig() === this.name);

    return ispTunnels[0] ?? null;
  }
}
