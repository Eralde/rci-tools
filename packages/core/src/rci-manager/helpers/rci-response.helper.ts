import {forEach, get, has, isArray, isObject, keys, pickBy, some} from 'lodash-es';
import type {GenericObject} from '../../type.utils';
import {RciError, RciStatusList, RciStatusObject} from './rci-response.types';

export class RciResponseHelper {
  public static hasCode(code: string, response: GenericObject | GenericObject[]): boolean {
    const statusList = RciResponseHelper.collectResponseStatuses(response);

    return statusList.some((status) => status.code === code);
  }

  public static hasErrors(response: GenericObject | GenericObject[]): boolean {
    // @see RCI_API.md -> 5. Generic status/error messages
    if (
      isObject(response)
      && !isArray(response)
      && (response['error'] || response['status'] === 'error')
    ) {
      return true;
    }

    if (
      isObject(response)
      || isArray(response)
    ) {
      return some(response, (item: GenericObject) => RciResponseHelper.hasErrors(item));
    }

    return false;
  }

  public static getErrors(response: GenericObject, errorsToOmit: string[] = []): Record<string, RciError> {
    const ndmErrors: Record<string, RciError> = {};

    RciResponseHelper.processNdmResponseErrors(response, (path: string, err: RciError) => {
      ndmErrors[path] = err;
    });

    return pickBy<RciError>(ndmErrors, (error) => !errorsToOmit.includes(error.code)) as Record<string, RciError>;
  }

  private static collectResponseStatuses(
    response: GenericObject | GenericObject[],
    currentPath: string[] = [],
  ): RciStatusList {
    const result: RciStatusList = [];

    if (isArray(response) || isObject(response)) {
      if (isArray(response)) {
        response.forEach((item, index) => {
          result.push(...this.collectResponseStatuses(item as GenericObject, [...currentPath, String(index)]));
        });
      } else {
        const keysList = keys(response);

        keysList.forEach((key) => {
          const value = response[key];
          const path = [...currentPath, key];

          if (key === 'status') {
            result.push({
              ...get(value, [0], {}) as RciStatusObject,
              path,
            });
          } else {
            result.push(...this.collectResponseStatuses(value as GenericObject, path));
          }
        });
      }
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
      isObject(response)
      && (
        has(response, 'error')
        || get(response, 'status') === 'error'
      )
    ) {
      const path = propertyPath
        .join('.')
        .replace('body.', '');

      const error = String(get(response, 'error') ?? '');
      const message = String(get(response, 'message') ?? '');
      const code = String(get(response, 'code') ?? '');

      onErrorFn(path, {error, message, code});
    } else if (isObject(response) || isArray(response)) {
      forEach(response, (value, key) => {
        RciResponseHelper.processNdmResponseErrors(value as GenericObject, onErrorFn, [...propertyPath, key]);
      });
    }
  }
}
