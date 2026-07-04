import * as _ from 'lodash-es';
import type {GenericObject} from '../../type.utils';
import {RciError, RciStatusList, RciStatusObject} from './rci-response.types';

export class RciResponseHelper {
  public static hasCode(code: string, response: GenericObject): boolean {
    const statusList = RciResponseHelper.collectResponseStatuses(response);

    return statusList.some((status) => status.code === code);
  }

  public static hasErrors(response: GenericObject): boolean {
    // @see RCI_API.md -> 5. Generic status/error messages
    if (
      _.isObject(response)
      && (response['error'] || response['status'] === 'error')
    ) {
      return true;
    }

    if (
      _.isObject(response)
      || _.isArray(response)
    ) {
      return _.some(response, (item: GenericObject) => RciResponseHelper.hasErrors(item));
    }

    return false;
  }

  public static getErrors(response: GenericObject, errorsToOmit: string[] = []): Record<string, RciError> {
    const ndmErrors: Record<string, RciError> = {};

    RciResponseHelper.processNdmResponseErrors(response, (path: string, err: RciError) => {
      ndmErrors[path] = err;
    });

    return _.pickBy<RciError>(ndmErrors, (error) => !errorsToOmit.includes(error.code)) as Record<string, RciError>;
  }

  private static collectResponseStatuses(
    response: GenericObject,
    currentPath: string[] = [],
  ): RciStatusList {
    const result: RciStatusList = [];

    if (_.isArray(response) || _.isObject(response)) {
      const keys = _.keys(response);

      keys.forEach((key) => {
        const value = response[key];
        const path = [...currentPath, key];

        if (key === 'status') {
          result.push({
            ..._.get(value, [0], {}) as RciStatusObject,
            path,
          });
        } else {
          result.push(...this.collectResponseStatuses(value as GenericObject, path));
        }
      });
    }

    return result;
  }

  private static processNdmResponseErrors(
    response: GenericObject,
    onErrorFn: (path: string, data: RciError) => unknown = () => {
    },
    propertyPath: string[] = [],
  ): void {
    if (
      _.isObject(response)
      && (
        _.has(response, 'error')
        || _.get(response, 'status') === 'error'
      )
    ) {
      const path = propertyPath
        .join('.')
        .replace('body.', '');

      const error = String(_.get(response, 'error') ?? '');
      const message = String(_.get(response, 'message') ?? '');
      const code = String(_.get(response, 'code') ?? '');

      onErrorFn(path, {error, message, code});
    } else if (_.isObject(response) || _.isArray(response)) {
      _.forEach(response, (value, key) => {
        RciResponseHelper.processNdmResponseErrors(value as GenericObject, onErrorFn, [...propertyPath, key]);
      });
    }
  }
}
