import * as _ from 'lodash-es';

export interface NdmDnsRecord {
  'name-server': string;
  'port': string;
}

export class DnsServerHelper {
  public static addressStrToNameServerObj(address: string): NdmDnsRecord {
    const chunks = address.split(':');

    return {
      'name-server': chunks[0] ?? '',
      'port': chunks[1] || '',
    };
  }

  public static nameServerObjToAddressStr(obj: string | NdmDnsRecord): string {
    if (_.isString(obj)) {
      return obj;
    }

    const suffix = obj.port ? `:${obj.port}` : '';

    return `${obj['name-server']}${suffix}`;
  }
}
