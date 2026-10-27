import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import type {BaseTrait} from '../../traits';
import {makeConfigurationQueries} from '../../helpers/query.helper';
import {BaseField} from '../_base.field';
import type {GenericObject} from '../../rci';

export interface OpmodeModel {
  mode: string;
  annex?: string; // only for ADSL
}

const MODE = 'mode';
const ANNEX = 'annex';

const isAdslSelected = (mode: string): boolean => {
  return !mode.startsWith('vdsl') && mode !== 'auto';
};

export class OpmodeField extends BaseField<OpmodeModel> {
  constructor(
    protected override entity: BaseTrait,
  ) {
    super(entity, 'operating-mode');
  }

  public getDefaultValue(): OpmodeModel {
    return {
      mode: 'auto',
      annex: '',
    };
  }

  public override readConfig(): OpmodeModel {
    const configuration = this.entity.dto.sc;
    const opmodeConfiguration = _.get(configuration, this.writePath, null);

    if (!opmodeConfiguration) {
      return this.getDefaultValue();
    }

    const mode = _.get(opmodeConfiguration, MODE) ?? this.getDefaultValue().mode;
    const annex = _.get(opmodeConfiguration, ANNEX, '');

    return {mode, annex};
  }

  public override getValueChangingQuery(model: OpmodeModel): RciQuery[] {
    const apiData: GenericObject = {
      [MODE]: model.mode,
    };

    if (model.annex) {
      if (isAdslSelected(model.mode)) {
        apiData[ANNEX] = model.annex;
      } else {
        this.entity.NDM.logger.info(
          `annex can only be configured for ADSL, '${model.mode}' mode passed; annex value will be ignored`,
        );
      }
    }

    return makeConfigurationQueries(this.entity.name, this.writePath, apiData);
  }

  protected override areValuesEqual(value1: Partial<OpmodeModel>, value2: Partial<OpmodeModel>): boolean {
    if (value1?.mode !== value2?.mode) {
      return false;
    }

    // annex is only relevant for ADSL, so we don't compare it for other modes
    if (['vdsl2-cpe', 'auto'].includes(value1?.mode ?? '')) {
      return true;
    }

    return super.areValuesEqual(value1, value2);
  }
}
