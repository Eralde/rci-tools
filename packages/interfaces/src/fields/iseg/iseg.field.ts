import type {SegmentEntity} from '../../entity/segment/segment.entity';
import type {IsegModel} from './iseg.types';
import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {VLAN_SUFFIX} from '../../entity-model.constants';
import {type PortEntity, isPortEntity} from '../../entity/port.entity';
import {NDM_INTERLAYER_NAME} from '../../entity-model.types';
import {BaseField} from '../_base.field';
import {type InterfaceIncludeType, type InterfaceIsegConfiguration, StringHelper} from '../../rci';

export class IsegField extends BaseField<IsegModel> {
  private readonly configuration: InterfaceIsegConfiguration;

  constructor(
    protected override entity: SegmentEntity,
  ) {
    super(entity, '');

    this.configuration = _.get(this.entity.dto, `sc.${NDM_INTERLAYER_NAME.ISEG}`, {}) as InterfaceIsegConfiguration;
  }

  public static getNdmIsegConfiguration(iseg: IsegModel): InterfaceIsegConfiguration {
    const ports = [...iseg.accessPorts, ...iseg.trunkPorts].join(',');
    const vlanPorts = iseg.trunkPorts.join(',');
    const includeList = iseg.include.join(',');

    return {
      'vlan': iseg.vlan,
      'port': ports,
      'vlan-port': vlanPorts,
      'include': includeList,
    };
  }

  public getDefaultValue(): IsegModel {
    return {
      vlan: '',
      accessPorts: [],
      trunkPorts: [],
      include: [],
    };
  }

  public override readConfig(): IsegModel {
    const port = StringHelper.stringToPortsArray(this.configuration.port);
    const trunkPorts = StringHelper.stringToPortsArray(this.configuration['vlan-port']);

    const accessPorts = _.difference(port, trunkPorts);
    const vlan = _.get(this.configuration, 'vlan', '');
    const include = _.get(this.configuration, 'include', '')
      .split(',')
      .filter(Boolean);

    return {
      vlan,
      accessPorts,
      trunkPorts,
      include,
    };
  }

  public getBusyVlanList(): number[] {
    const busyVlanStr = _.get(this.configuration, 'busy-vlan', '');

    return String(busyVlanStr)
      .split(',')
      .filter(Boolean)
      .map(Number);
  }

  public getAccessPorts(): PortEntity[] {
    const accessPortLabelList = this.readConfig().accessPorts;

    return this.entity.collection
      .filter(isPortEntity)
      .filter((item) => accessPortLabelList.includes(item.getLabel()));
  }

  public override getValueChangingQuery(iseg: IsegModel): RciQuery[] {
    const isegData = IsegField.getNdmIsegConfiguration(iseg);

    return makeConfigurationQueries(this.entity.name, NDM_INTERLAYER_NAME.ISEG, isegData);
  }

  public getCurrentVlanId(): string {
    // Each segment created with `interface iseg` will have a `Vlan` interface bound to it.
    // But the `include` field in the `iseg` configuration will not contain this `Vlan` interface.
    // To get its index (VLAN id), we need to read the configuration of the segment entity itself.
    // The Vlan interface will be either in the list of interfaces included in the segment
    // or in the `inherit` configuration block.
    const configuration = this.entity.dto?.sc;

    if (_.has(configuration, 'inherit')) {
      const inheritInterfaceId = _.get(configuration, 'inherit.interface', '');
      const chunks = String(inheritInterfaceId).split(VLAN_SUFFIX);

      return chunks[1] ?? '';
    }

    const includeList: string[] = (_.get(configuration, 'include', []) as InterfaceIncludeType[])
      .map((item) => String(_.get(item, 'interface', '')))
      .filter(Boolean);

    const includedVlanId = _.find(includeList, (id) => id.includes(VLAN_SUFFIX));

    if (!includedVlanId) {
      return '';
    }

    const chunks = String(includedVlanId).split(VLAN_SUFFIX);

    return chunks[1] ?? '';
  }
}
