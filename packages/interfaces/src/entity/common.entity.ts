import {Mixin} from 'ts-mixer';
import {BaseTrait, DeletableTrait, IgmpTrait, IpDnsTrait, IpTrait, RolesTrait} from '../traits';

// dprint-ignore
export interface CommonEntity extends
  BaseTrait,
  DeletableTrait,
  IgmpTrait,
  IpDnsTrait,
  IpTrait,
  RolesTrait
{
}

const CommonEntityMixin = Mixin(
  Mixin(
    BaseTrait,
    DeletableTrait,
    IgmpTrait,
    IpDnsTrait,
    IpTrait,
  ),
  Mixin(
    RolesTrait,
  ),
);

/**
 * This class represents any interface that does not have an entity class defined for itself.
 */
export class CommonEntity extends CommonEntityMixin implements CommonEntity {
}
