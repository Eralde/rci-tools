import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import type {BaseTrait} from '../../traits';
import {BaseField} from '../_base.field';
import {IP_REMOTE, IP_REMOTE_ADDRESS} from './ip.constants';
import {IP_MASK_SINGLE, NO_COMMAND} from '../../rci';

export class IpRemoteField extends BaseField<string> {
  constructor(
    protected override entity: BaseTrait,
  ) {
    super(entity, IP_REMOTE);
  }

  public getDefaultValue(): string {
    return '';
  }

  public override readConfig(): string {
    return _.get(this.entity.dto.sc, IP_REMOTE_ADDRESS, '') as string;
  }

  public override getValueChangingQuery(remote: string): RciQuery[] {
    const ipRemoteData = remote
      ? [NO_COMMAND, {address: remote, mask: IP_MASK_SINGLE}]
      : NO_COMMAND;

    const remoteQueries = [_.set({}, IP_REMOTE, ipRemoteData)];

    return makeConfigurationQueries(
      this.entity.name,
      [
        ...remoteQueries,
      ],
    );
  }
}
