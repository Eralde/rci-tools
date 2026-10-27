/**
 * Generate NDM-query to modify current entity.
 * Command generator is based on `this.name` and `INTERFACE_COMMAND`
 * ----
 * Example (when name=Bridge0 and NDM_PATH=interface):
 * this.makeConfigurationQueries({description: 'lorem ipsum'})
 * // will output --> [{interface: {description: 'lorem ipsum', name: Bridge0}}]
 * ----
 * For syntax sugar this method is polymorphic:
 * argument:  this.makeConfigurationQueries('description', 'lorem ipsum')
 * equals to: this.makeConfigurationQueries({description: 'lorem ipsum'})
 */

import * as _ from 'lodash-es';
import type {RciQuery} from '@rci-tools/core';
import {type GenericObject, INTERFACE_COMMAND} from '../rci';
import type {ModelLogger} from '../context';

export const makeConfigurationQueries = (
  name: string,
  dataOrPath: string | GenericObject | boolean, // check types
  dataIfPathOrNothing: unknown = null,
): RciQuery[] => {
  const data = _.isString(dataOrPath) ? _.set({}, dataOrPath, dataIfPathOrNothing) : dataOrPath;
  const dataArray = _.isArray(data) ? data : [data];

  const queries = dataArray.map((dataObject) => {
    return {
      path: INTERFACE_COMMAND,
      data: {...dataObject, name},
      extractData: false,
    };
  });

  return queries;
};

export const makeInterlayerCreationQueries = <NdmInterlayerData>(
  interlayerName: string,
  interlayerData: NdmInterlayerData | NdmInterlayerData[],
  nameProperty: string = 'name',
  logger?: ModelLogger,
): RciQuery[] => {
  if (!interlayerName) {
    logger?.error('[makeInterlayerConfigurationQueries]: "interlayerName" argument cannot be empty!');

    return [];
  }

  if (!nameProperty) {
    logger?.error('[makeInterlayerConfigurationQueries]: "nameProperty" argument cannot be empty!');

    return [];
  }

  const dataList: NdmInterlayerData[] = _.isArray(interlayerData)
    ? interlayerData
    : [interlayerData];

  return dataList.map((item) => {
    return {
      path: `${INTERFACE_COMMAND}.${interlayerName}`,
      data: {...item, [nameProperty]: ''},
      extractData: false,
    };
  });
};

export const getNextName = (
  type: string,
  usedNames: string[] = [],
  options: {
    prefix?: string;
    startIndex?: number;
  } = {},
): string => {
  const {prefix, startIndex} = {
    prefix: '',
    startIndex: 0,
    ...options,
  };

  let counter = startIndex;

  while (true) {
    const nextName = prefix + type + String(counter);

    if (!usedNames.includes(nextName)) {
      return nextName;
    }

    counter += 1;
  }
};
