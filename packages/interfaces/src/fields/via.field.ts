import type {RciQuery} from '@rci-tools/core';
import type {InterfaceEntityType} from '../entity-model.types';
import {makeConfigurationQueries} from '../helpers/query.helper';
import type {BaseTrait} from '../traits';
import {BaseField} from './_base.field';

/**
 * For historical reasons there is an option to set the "via" field in the "connect" object,
 * and then disable the connection, so the final configuration will look like this:
 * ```json
 * {
 *   "interface": {
 *     "PPTP0": {
 *       "connect": {
 *         "via": "ISP",
 *         "no": true
 *       }
 *     }
 *   }
 * }
 *
 * ```
 *
 * Frontend doesn't use this feature, but that's why this field is a separate class
 * rather than a WrappedString or similar.
 */
export class ViaField extends BaseField<string> {
  constructor(
    protected override entity: BaseTrait,
    public override writePath: string = 'connect',
  ) {
    super(entity, writePath, {readPath: `sc.${writePath}.via`});
  }

  public getDefaultValue(): string {
    return '';
  }

  public override getValueChangingQuery(via: string): RciQuery[] {
    return makeConfigurationQueries(
      this.entity.name,
      this.writePath,
      {
        via: via || '',
      },
    );
  }

  public setEntity(target: InterfaceEntityType | null): RciQuery[] {
    return this.getValueChangingQuery(target ? target.name : '');
  }
}
