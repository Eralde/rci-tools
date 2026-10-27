import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {ModelContext} from '../../context';
import type {DelayedInitActions, EntityDto, InterfaceEntityType} from '../../entity-model.types';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {BaseTrait} from './base.trait';
import {type NdmNetworkRole} from '../../rci';

type NdmRoleType = {
  role: NdmNetworkRole;
  ifor?: string;
} | NdmNetworkRole;

export interface RolesTrait {
  roles: NdmNetworkRole[];

  getRoles(): NdmNetworkRole[];
  getChangeRoleQuery(roles: NdmNetworkRole[]): RciQuery[];
  hasAnyRole(): boolean;
  hasRole(ndmRole: NdmNetworkRole): boolean;
  hasRoleOwner(): boolean;
  getRoleOwner(): InterfaceEntityType | null;
}

export class RolesTrait extends BaseTrait implements RolesTrait {
  constructor(
    public override dto: EntityDto,
    public override NDM: ModelContext,
    public override delayedInitActions: DelayedInitActions<BaseTrait>,
  ) {
    super(dto, NDM, delayedInitActions);
  }

  // Each role in the DTO 'role' property can be:
  // A) a string (e.g. ndmRoles === ['inet', 'misc'])
  // B) an object (ndmRoles === [{role: 'inet', ifor: 'GigabitEthernet0/Vlan7'}])
  public getRoles(): NdmNetworkRole[] {
    const roles: NdmRoleType[] = _.get(this, 'dto.sc.role', []);

    return roles.map((roleObj: NdmRoleType) => {
      return _.isString(roleObj) ? roleObj : roleObj.role;
    });
  }

  public getChangeRoleQuery(roles: NdmNetworkRole[]): RciQuery[] {
    const name = _.get(this, 'dto.show.id', '');

    return makeConfigurationQueries(name, {role: roles});
  }

  public hasAnyRole(): boolean {
    const roles = this.getRoles();

    return roles.length > 0;
  }

  public hasRole(ndmRole: NdmNetworkRole): boolean {
    return this.getRoles().includes(ndmRole);
  }

  public hasRoleOwner(): boolean {
    const ifor = String(_.get(this, 'dto.sc.role[0].ifor', ''));

    if (!ifor) {
      return false;
    }

    return this._collection.some((item) => item.name === ifor);
  }

  public getRoleOwner(): InterfaceEntityType | null {
    const ifor = String(_.get(this, 'dto.sc.role[0].ifor', ''));

    if (!ifor) {
      return null;
    }

    return this._collection.find((item) => item.name === ifor) || null;
  }
}
