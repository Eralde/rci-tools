import type {DelayedInitActions, EntityDto} from '../../entity-model.types';
import type {ModelContext} from '../../context';
import {DnsServerHelper, type NdmDnsRecord} from '../../helpers';
import {IP_NAME_SERVER, ObjectListField} from '../../fields';
import {BaseTrait} from '../base/base.trait';

export interface IpDnsTrait extends BaseTrait {
  dnsV4: ObjectListField<NdmDnsRecord>;
}

export class IpDnsTrait extends BaseTrait implements IpDnsTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);

    this.dnsV4 = new ObjectListField(
      this,
      DnsServerHelper.addressStrToNameServerObj,
      DnsServerHelper.nameServerObjToAddressStr,
      IP_NAME_SERVER,
    );
  }
}
