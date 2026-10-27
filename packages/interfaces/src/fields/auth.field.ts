import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {BaseField} from './_base.field';
import type {BaseTrait} from '../traits';
import {makeConfigurationQueries} from '../helpers/query.helper';
import {type GenericObject, NO_COMMAND, type Values} from '../rci';

export const AUTH_TYPE = {
  // "virtual" value (no `authentication` block in the interface configuration or no algorithm specified)
  AUTO: 'auto',
  PAP: 'pap',
  CHAP: 'chap',
  MSCHAP: 'mschap',
  MSCHAP_V2: 'mschap-v2',
} as const;

export type AuthType = Values<typeof AUTH_TYPE>;

export interface AuthModel {
  type: AuthType;
  identity: string;
  password: string;
}

const IDENTITY = 'identity';
const PASSWORD = 'password';

const NDM_AUTH_TYPE_KEYWORDS = Object.values(AUTH_TYPE).filter((item) => item !== AUTH_TYPE.AUTO);

export class AuthField extends BaseField<AuthModel> {
  constructor(
    protected override entity: BaseTrait,
  ) {
    super(entity, 'authentication');
  }

  public getDefaultValue(): AuthModel {
    return {
      type: AUTH_TYPE.AUTO,
      identity: '',
      password: '',
    };
  }

  public override readConfig(): AuthModel {
    const configuration = this.entity.dto.sc;
    const authData = _.get(configuration, this.writePath, null);

    if (!authData) {
      return this.getDefaultValue();
    }

    const type = NDM_AUTH_TYPE_KEYWORDS.find((keyword) => _.has(authData, keyword))
      || AUTH_TYPE.AUTO;

    const identity = _.get(authData, IDENTITY, '');
    const password = _.get(authData, PASSWORD, '');

    return {
      type: type,
      identity,
      password,
    };
  }

  public override getValueChangingQuery(model: AuthModel): RciQuery[] {
    if (!model.identity || !model.password) {
      this.entity.NDM.logger.info(
        `"${this.writePath}" block with empty ${IDENTITY} or ${PASSWORD} is meaningless; cleanup`,
      );

      return makeConfigurationQueries(this.entity.name, this.writePath, this.getClearQueryData());
    }

    if (!model.type) {
      this.entity.NDM.logger.info('No authentication type specified; cleanup');

      return makeConfigurationQueries(this.entity.name, this.writePath, this.getClearQueryData());
    }

    const data = NDM_AUTH_TYPE_KEYWORDS
      .reduce<GenericObject>(
        (acc, keyword) => {
          acc[keyword] = model.type === keyword;

          return acc;
        },
        {
          [IDENTITY]: model.identity,
          [PASSWORD]: model.password,
        },
      );

    return makeConfigurationQueries(this.entity.name, this.writePath, data);
  }

  protected getClearQueryData(): GenericObject {
    const clearAuthTypes = NDM_AUTH_TYPE_KEYWORDS
      .reduce<GenericObject>(
        (acc, keyword) => {
          acc[keyword] = NO_COMMAND;

          return acc;
        },
        {},
      );

    return {
      ...clearAuthTypes,
      [IDENTITY]: NO_COMMAND,
      [PASSWORD]: NO_COMMAND,
      ...NO_COMMAND,
    };
  }
}
