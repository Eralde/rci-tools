import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {BooleanField} from '../basic';
import type {BaseTrait} from '../../traits/base/base.trait';
import {makeConfigurationQueries} from '../../helpers';

export class ConnectField extends BooleanField {
  constructor(
    public override entity: BaseTrait,
  ) {
    super(
      entity,
      'connect',
      {
        defaultValue: false,
        readPath: 'connect.no',
      },
    );
  }

  public override getDefaultValue(): boolean {
    return this.options?.defaultValue ?? false;
  }

  public override readConfig(): boolean {
    return !_.get(this.entity.dto, this.readPath);
  }

  public override writeConfig(model: boolean): RciQuery[] {
    return makeConfigurationQueries(
      this.entity.name,
      this.writePath,
      {
        no: !model,
      },
    );
  }
}
