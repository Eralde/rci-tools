import {hasMixin} from 'ts-mixer';
import * as _ from 'lodash-es';
import {
  type DelayedInitActions,
  type DslPvc,
  type EntityDto,
  type EntityLabelData,
  NDM_INTERFACE_TYPE,
} from '../../entity-model.types';
import type {ModelContext} from '../../context';
import {RolesTrait} from './roles.trait';
import type {BaseTrait} from './base.trait';

export interface RoleLabelTrait {
  getIpvcRoleLabelData(roleOwner: BaseTrait | null): EntityLabelData;
  getIpoeRoleLabelData(): EntityLabelData;
}

/**
 * Complex `ipoe`/`ipvc` configurations contain additional
 * interfaces (Vlan/Pvc/Bridge/...) that represent special "roles" in the system.
 * This trait will simplify overloading `getLabelData` method
 * for entity classes that represent such interfaces.
 */
export class RoleLabelTrait extends RolesTrait implements RolesTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);
  }

  /**
   * This method provides the data required to generate an entity label
   * for entities that represent a "role" for a DSL interface.
   */
  public getIpvcRoleLabelData(roleOwner: BaseTrait | null): EntityLabelData {
    const labelData = roleOwner
      ? roleOwner.getLabelData()
      : super.getLabelData();

    const vlanList = this.type === NDM_INTERFACE_TYPE.Vlan
      ? [String(this.getIndex())]
      : [];

    const pvcList: DslPvc[] = [];

    if (this.type === NDM_INTERFACE_TYPE.Pvc) {
      pvcList.push({
        vpi: _.get(this.dto, 'show.vpi', ''),
        vci: _.get(this.dto, 'show.vci', ''),
        encapsulation: _.get(this.dto, 'show.encapsulation', ''),
      });
    }

    labelData.suffixData = {
      vlanList,
      pvcList,
      role: this.getRoles()[0],
    };

    return labelData;
  }

  /**
   * This method provides the data required to generate an entity label
   * for entities that represent a "role" for an IPoE interface.
   */
  public getIpoeRoleLabelData(): EntityLabelData {
    const roleOwner = this.getRoleOwner();

    if (!roleOwner) {
      return super.getLabelData();
    }

    const vlan = String(_.get(this.dto, 'show.index', ''));

    // If "roleOwner" entity found above also has role for another interface,
    // then `this` entity represents an MVR IPTV VLAN ("additional IPTV VLAN"):
    //
    // `this`
    //    -> Bridge | Vlan
    //      -> IPoE
    //
    // 'A -> B' means 'A has role for B'
    //
    const ipoeOwner = hasMixin(roleOwner, RolesTrait) && roleOwner.hasRoleOwner()
      ? roleOwner.getRoleOwner()
      : roleOwner;

    if (!ipoeOwner) {
      return super.getLabelData();
    }

    const isAdditionalVlan = ipoeOwner.name !== roleOwner.name;
    const labelData = ipoeOwner.getLabelData();

    labelData.suffixData = {
      vlanList: [vlan],
      isAdditionalVlan,
      role: this.getRoles()[0],
    };

    return labelData;
  }
}
