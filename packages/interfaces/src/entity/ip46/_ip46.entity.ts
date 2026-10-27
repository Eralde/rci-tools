import {Mixin} from 'ts-mixer';
import * as Traits from '../../traits';

// dprint-ignore
export interface Ip46Entity extends
  Traits.BaseTrait,
  Traits.CreateDeleteTrait,
  Traits.Ip46Trait,
  Traits.RolesTrait
{
}

const Ip46EntityMixin = Mixin(
  Mixin(
    Traits.BaseTrait,
    Traits.CreateDeleteTrait,
    Traits.Ip46Trait,
    Traits.RolesTrait,
  ),
);

export abstract class Ip46Entity extends Ip46EntityMixin implements Ip46Entity {
  public abstract getCurrentSource(): string;
  public abstract getCurrentDestination(): string;
}
