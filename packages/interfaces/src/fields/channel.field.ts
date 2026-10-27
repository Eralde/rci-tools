import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../traits';
import {StringField} from './basic';
import {makeConfigurationQueries} from '../helpers';
import {WIFI_DEFAULT_CHANNEL} from '../rci';

export class ChannelField extends StringField {
  constructor(
    public override entity: BaseTrait,
  ) {
    super(entity, 'channel.channel');
  }

  public override getDefaultValue(): string {
    return WIFI_DEFAULT_CHANNEL; // special value
  }

  public override getValueChangingQuery(data: string): RciQuery[] {
    if (data === WIFI_DEFAULT_CHANNEL || !data) {
      return makeConfigurationQueries(this.entity.name, this.writePath, false);
    }

    return super.getValueChangingQuery(data);
  }
}
