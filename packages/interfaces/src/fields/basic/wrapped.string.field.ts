import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import type {BaseTrait} from '../../traits';
import {BaseField, type FieldOptions} from '../_base.field';
import {NO_COMMAND} from '../../rci';

/**
 * This class represents a string value that is wrapped into an extra object due to the design of the RCI.
 * E.g. `interface {name} mobile operator {plmn}` command is equal to the following JSON RCI
 * (parts enclosed in "<>" are string variables):
 * ```
 * {
 *   interface: {
 *     <name>: {
 *       mobile: {
 *         operator: {
 *           plmn: '<PLMN_VALUE>'
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 * We need to send the JSON above to set the `<name>` interface PLMN value to `<PLMN_VALUE>`.
 * To read current PLMN value we would use something like this:
 * ```
 * const plmn = _.get(interfaceConfiguration, 'mobile.operator.plmn', ''); // defaults to '' if no PLMN is set
 * ```
 *
 * However, to clear the configured PLMN value we must send a slightly different JSON:
 * ```
 * {
 *   interface: {
 *     <name>: {
 *       mobile: {
 *         operator: {
 *           no: true
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * This class is designed to handle both queries that change & reset a specific settings.
 * It should be used to avoid multiple implementations of similar "wrappers".
 * To handle the 'plmn' example above instantiate it like this:
 *
 * ```
 * const plmnField = new WrappedStringField(entity, 'mobile.operator', 'plmn');
 * ```
 */
export class WrappedStringField extends BaseField<string> {
  constructor(
    protected override entity: BaseTrait,
    public override writePath: string,
    public wrapperPropertyName: string,
    public override options: FieldOptions<string> = {},
  ) {
    super(entity, writePath);

    this.readPath = `sc.${this.writePath}.${this.wrapperPropertyName}`;
  }

  public getDefaultValue(): string {
    return this.options?.defaultValue ?? '';
  }

  public override readConfig(): string {
    const config = _.get(this.entity.dto, this.readPath, this.getDefaultValue());

    return String(config);
  }

  public override getValueChangingQuery(value: string): RciQuery[] {
    if (!this.areRequirementsFulfilled()) {
      return [];
    }

    const data = value
      ? {[this.wrapperPropertyName]: value}
      : NO_COMMAND;

    return makeConfigurationQueries(this.entity.name, this.writePath, data);
  }
}
