import * as _ from 'lodash-es';

export interface NetworkIpoeRole {
  ports: string[];
  vlans: number[];
}

export interface NetworkIpoeModel {
  inet: NetworkIpoeRole;
  iptv: NetworkIpoeRole;
  voip: NetworkIpoeRole;
}

export type MinimalIpoeModel = Partial<NetworkIpoeModel> & {inet: {ports: string[]}};

export const isMinimalIpoeModel = (o: unknown): o is MinimalIpoeModel => {
  return _.has(o, 'inet')
    && _.isArray(_.get(o, 'inet.ports'))
    && _.isString(_.get(o, 'inet.ports[0]'));
};
