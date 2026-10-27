import {type NdmNetworkRole} from '../../rci';

export interface IpvcModel {
  role: NdmNetworkRole;
  vpi: string;
  vci: string;
  encapsulation: string;
  vlan: string;
  ports: string[];
  vlanOverPvc: boolean;
}
